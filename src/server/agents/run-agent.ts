import "server-only";

import { shouldUseMockData } from "@/lib/env";
import { AnthropicApiError } from "@/lib/anthropic/managed-agents-api";
import { getAgentAdapter } from "@/server/agents/get-agent-adapter";
import { finalizeAgentRun } from "@/server/agents/finalize-agent-run";
import { createRoomMessage } from "@/server/messages/room-message-service";
import {
  getAgentMemoryAttachments,
  getAgentStartupContext,
  getProjectObserverContext,
} from "@/server/memory/domain-memory-service";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";
import { requireRoomMember } from "@/server/auth/require-room-member";
import { resolveRoomThread } from "@/server/rooms/thread-service";
import { isDevelopmentAgent } from "@/lib/agents/development-agent";
import type { AgentRun, AgentRunMode, AgentRunType, RoomMessage } from "@/types/domain";

type RunAgentInput = {
  userId: string;
  roomId: string;
  threadId?: string | null;
  agentId?: string;
  message: string;
  inputMessageId?: string | null;
  mode?: AgentRunMode;
  runType?: AgentRunType;
  guestSourceRoomId?: string | null;
};

type AgentRunJob = {
  runId: string;
  userId: string;
  roomId: string;
  threadId: string;
  agentId: string;
  message: string;
  mode: AgentRunMode;
  guestSourceRoomId: string | null;
};

type StartedAgentRun = {
  run: AgentRun;
  inputMessage: RoomMessage;
  job: AgentRunJob;
};

function getSource() {
  return shouldUseMockData() ? mockStore : supabaseStore;
}

export async function startAgentRun(input: RunAgentInput): Promise<StartedAgentRun> {
  await requireRoomMember(input.userId, input.roomId);
  const source = getSource();

  const agent = input.agentId
    ? await source.getAgent(input.agentId)
    : await source.getAgentByRoom(input.guestSourceRoomId ?? input.roomId);

  if (!agent) {
    throw new Error("연결된 봇이 없습니다.");
  }

  const mode = input.mode ?? "room";
  const guestSourceRoomId = input.guestSourceRoomId ?? (mode === "meeting_guest" ? agent.roomId : null);

  if (mode === "meeting_guest") {
    if (input.roomId !== "meeting") {
      throw new Error("게스트 봇 호출은 메인 회의방에서만 가능합니다.");
    }
    await requireRoomMember(input.userId, guestSourceRoomId ?? agent.roomId);
  } else if (agent.roomId !== input.roomId && !isDevelopmentAgent(agent)) {
    throw new Error("이 방의 상주 봇만 호출할 수 있습니다.");
  }

  const existingInputMessage = input.inputMessageId
    ? await getExistingInputMessage(input.roomId, input.inputMessageId)
    : null;
  const thread = await resolveRoomThread(input.userId, input.roomId, existingInputMessage?.threadId ?? input.threadId);

  const inputMessage = existingInputMessage
    ? existingInputMessage
    : await createRoomMessage({
        userId: input.userId,
        roomId: input.roomId,
        threadId: thread.id,
        content: input.message,
        type: "human",
      });

  const run = await source.createAgentRun({
    roomId: input.roomId,
    threadId: thread.id,
    agentId: agent.id,
    initiatedBy: input.userId,
    mode,
    runType: input.runType ?? (mode === "meeting_guest" ? "meeting_guest" : "room_agent"),
    guestSourceRoomId,
    inputMessageId: inputMessage.id,
    status: "queued",
  });

  return {
    run,
    inputMessage,
    job: {
      runId: run.id,
      userId: input.userId,
      roomId: input.roomId,
      threadId: thread.id,
      agentId: agent.id,
      message: input.message,
      mode,
      guestSourceRoomId,
    },
  };
}

export async function completeAgentRun(job: AgentRunJob) {
  const source = getSource();
  const runningRun = await source.updateAgentRun(job.runId, { status: "running" });
  if (!runningRun) {
    throw new Error("봇 실행을 찾을 수 없습니다.");
  }

  await source.addAuditLog({
    actorUserId: job.userId,
    actorAgentId: job.agentId,
    roomId: job.roomId,
    action: "agent.run.started",
    targetType: "agent_run",
    targetId: job.runId,
  });

  try {
    const adapter = getAgentAdapter();
    const startupContext = await getRunStartupContext(job);
    const memoryAttachments = await getRunMemoryAttachments(job);
    const result = await adapter.run({
      agentRunId: job.runId,
      roomId: job.roomId,
      threadId: job.threadId,
      agentId: job.agentId,
      userId: job.userId,
      message: job.message,
      mode: job.mode,
      guestSourceRoomId: job.guestSourceRoomId,
      startupContext,
      memoryAttachments,
    });

    for (const event of result.events ?? []) {
      await source.addAgentRunEvent(job.runId, event.type, event.payload);
    }

    const outputMessage = await source.createMessage({
      roomId: job.roomId,
      threadId: job.threadId,
      type: job.mode === "meeting_guest" ? "guest_agent" : "agent",
      content: result.content,
      senderUserId: null,
      senderAgentId: job.agentId,
      agentRunId: job.runId,
      metadata: {
        sourceRoomId: job.guestSourceRoomId ?? job.roomId,
        autoExitAfterTurns: job.mode === "meeting_guest" ? 3 : undefined,
        generatedFiles: result.generatedFiles?.map((file) => ({
          id: file.id,
          originalName: file.originalName,
          sizeBytes: file.sizeBytes,
          mimeType: file.mimeType,
        })),
      },
    });

    const completedRun = await source.updateAgentRun(job.runId, {
      status: result.requiresAction ? "requires_action" : "completed",
      anthropicSessionId: result.anthropicSessionId ?? null,
      outputMessageId: outputMessage.id,
      tokenUsage: result.tokenUsage ?? {},
      endedAt: new Date().toISOString(),
    });

    await source.addAuditLog({
      actorUserId: job.userId,
      actorAgentId: job.agentId,
      roomId: job.roomId,
      action: "agent.run.completed",
      targetType: "agent_run",
      targetId: job.runId,
    });

    await finalizeAgentRun(job.runId);
    return { run: completedRun, outputMessage };
  } catch (error) {
    await source.updateAgentRun(job.runId, {
      status: "failed",
      error: agentRunErrorMessage(error),
      endedAt: new Date().toISOString(),
    });
    await source.addAuditLog({
      actorUserId: job.userId,
      actorAgentId: job.agentId,
      roomId: job.roomId,
      action: "agent.run.failed",
      targetType: "agent_run",
      targetId: job.runId,
      metadata: { error: error instanceof Error ? error.message : error },
    });
    throw error;
  }
}

export async function runAgent(input: RunAgentInput) {
  const started = await startAgentRun(input);
  const completed = await completeAgentRun(started.job);
  return { ...completed, inputMessage: started.inputMessage };
}

async function getExistingInputMessage(roomId: string, inputMessageId: string) {
  const source = getSource();
  const inputMessage = (await source.listMessages(roomId)).find((message) => message.id === inputMessageId);
  if (!inputMessage || inputMessage.roomId !== roomId) {
    throw new Error("연결할 입력 메시지를 찾을 수 없습니다.");
  }
  return inputMessage;
}

async function getRunStartupContext(job: AgentRunJob) {
  const source = getSource();
  const agent = job.agentId ? await source.getAgent(job.agentId) : null;
  if (isDevelopmentAgent(agent)) {
    const [currentRoomContext, developmentRoomContext, projectOverview] = await Promise.all([
      getAgentStartupContext(job.roomId, job.mode, { threadId: job.threadId, messageLimit: 24 }),
      agent?.roomId && agent.roomId !== job.roomId
        ? getAgentStartupContext(agent.roomId, "room", { messageLimit: 0 })
        : Promise.resolve(null),
      getProjectObserverContext(job.userId, {
        currentRoomId: job.roomId,
        currentThreadId: job.threadId,
        messageLimitPerRoom: 4,
      }),
    ]);

    return {
      mode: job.mode,
      instruction:
        "개발봇은 모든 접근 가능 업무방의 흐름을 관찰 가능한 프로젝트 맥락으로 읽고, 담당자와 도메인 봇의 대화에서 플랫폼 개선 기회, 구현 계획, 리스크, 전체 진행 상황을 제안한다. 토글이 꺼져 있을 때는 발언하지 않지만, 호출되면 누적된 방 대화와 요약을 근거로 답한다.",
      developmentAgent: {
        globalObserver: true,
        homeRoomId: agent?.roomId ?? null,
        activeRoomId: job.roomId,
        currentThreadId: job.threadId,
      },
      currentRoom: currentRoomContext,
      developmentRoom: developmentRoomContext,
      projectOverview,
    };
  }

  if (job.mode !== "meeting_guest" || !job.guestSourceRoomId) {
    return getAgentStartupContext(job.roomId, job.mode, { threadId: job.threadId, messageLimit: 18 });
  }

  const [meetingContext, sourceRoomContext] = await Promise.all([
    getAgentStartupContext(job.roomId, job.mode, { threadId: job.threadId, messageLimit: 24 }),
    getAgentStartupContext(job.guestSourceRoomId, "room", { messageLimit: 0 }),
  ]);

  return {
    mode: job.mode,
    instruction:
      "메인 회의방의 사람 발언과 다른 봇 발언을 함께 읽고, 담당 업무방 관점에서 동의점, 우려점, 다음 행동을 제안한다.",
    meetingRoom: meetingContext,
    sourceRoom: sourceRoomContext,
  };
}

async function getRunMemoryAttachments(job: AgentRunJob) {
  const source = getSource();
  const agent = job.agentId ? await source.getAgent(job.agentId) : null;
  if (isDevelopmentAgent(agent)) {
    const roomIds = [job.roomId, agent?.roomId].filter((roomId): roomId is string => Boolean(roomId));
    const attachments = await Promise.all(
      [...new Set(roomIds)].map((roomId) => getAgentMemoryAttachments(roomId, "read_only")),
    );
    return attachments.flat();
  }

  if (job.mode === "meeting_guest" && job.guestSourceRoomId) {
    const [meeting, sourceRoom] = await Promise.all([
      getAgentMemoryAttachments(job.roomId, "read_only"),
      getAgentMemoryAttachments(job.guestSourceRoomId, "read_only"),
    ]);
    return [...meeting, ...sourceRoom];
  }

  return getAgentMemoryAttachments(job.roomId, "read_only");
}

function agentRunErrorMessage(error: unknown) {
  if (error instanceof AnthropicApiError) {
    const requestId = error.requestId ? ` 요청 ID: ${error.requestId}` : "";
    return `Anthropic API가 일시적으로 실패했습니다. 잠시 후 다시 시도해 주세요. (${error.method} ${error.path}, ${error.status})${requestId}`;
  }
  return error instanceof Error ? error.message : "Unknown error";
}
