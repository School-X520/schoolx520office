import "server-only";

import { shouldUseMockData } from "@/lib/env";
import { AnthropicApiError } from "@/lib/anthropic/managed-agents-api";
import { AGENT_RUN_PROGRESS_EVENT, agentRunProgressPayload } from "@/server/agents/agent-run-activity";
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
import { canWriteRoom, requireRoomMember } from "@/server/auth/require-room-member";
import { ForbiddenError } from "@/server/auth/errors";
import { resolveRoomThread } from "@/server/rooms/thread-service";
import {
  getCoordinatorAgent,
  isCoordinatorAgent,
  isDevelopmentAgent,
} from "@/lib/agents/development-agent";
import { mirrorDevelopmentAgentRequest } from "@/server/agents/development-request-mirror";
import { generateCoordinatorBriefing } from "@/server/coordinator/coordinator-briefing-service";
import type { AgentRun, AgentRunMode, AgentRunType, CoordinatorBriefing, RoomBriefing, RoomMessage } from "@/types/domain";
import type { AgentStreamEvent } from "@/server/agents/types";

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
  intent?: "development_request" | null;
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

const activeAgentRunControllers = new Map<string, AbortController>();
const terminalAgentRunStatuses = new Set<AgentRun["status"]>(["completed", "failed", "cancelled"]);

class AgentRunCancelledError extends Error {
  constructor() {
    super("봇 실행이 중단되었습니다.");
    this.name = "AgentRunCancelledError";
  }
}

function getSource() {
  return shouldUseMockData() ? mockStore : supabaseStore;
}

type AgentRunSource = ReturnType<typeof getSource>;

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
    if (!isDevelopmentAgent(agent)) {
      await requireRoomMember(input.userId, guestSourceRoomId ?? agent.roomId);
    }
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
    agentId: isCoordinatorAgent(agent) ? null : agent.id,
    initiatedBy: input.userId,
    mode,
    runType: input.runType ?? (mode === "meeting_guest" ? "meeting_guest" : "room_agent"),
    guestSourceRoomId,
    inputMessageId: inputMessage.id,
    status: "queued",
    metadata: {
      ...(isCoordinatorAgent(agent)
        ? {
            coordinatorAgentId: agent.id,
            guestLabel: agent.name,
            coordinatorPm: true,
          }
        : {}),
      ...(input.intent ? { requestIntent: input.intent } : {}),
    },
  });
  const mirroredRun = await mirrorDevelopmentAgentRequest({
    source,
    agent,
    run,
    userId: input.userId,
    sourceRoomId: input.roomId,
    sourceThreadId: thread.id,
    inputMessage,
  });

  await recordProgress(source, mirroredRun.id, {
    key: "queued",
    title: "실행 요청 접수",
    detail: agent.name,
  });

  return {
    run: mirroredRun,
    inputMessage,
    job: {
      runId: mirroredRun.id,
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
  const existingRun = await getAgentRunById(source, job.runId);
  if (!existingRun) {
    throw new Error("봇 실행을 찾을 수 없습니다.");
  }
  if (terminalAgentRunStatuses.has(existingRun.status)) {
    return { run: existingRun, outputMessage: null };
  }

  const controller = new AbortController();
  activeAgentRunControllers.set(job.runId, controller);

  try {
    const runningRun = await source.updateAgentRun(job.runId, { status: "running" });
    if (!runningRun) {
      throw new Error("봇 실행을 찾을 수 없습니다.");
    }
    await recordProgress(source, job.runId, {
      key: "started",
      title: "실행 시작",
      detail: "방 권한과 대화 맥락을 확인합니다.",
    });

    await source.addAuditLog({
      actorUserId: job.userId,
      actorAgentId: auditActorAgentId(job.agentId),
      roomId: job.roomId,
      action: "agent.run.started",
      targetType: "agent_run",
      targetId: job.runId,
    });

    await assertAgentRunActive(source, job.runId, controller.signal);
    const agent = await source.getAgent(job.agentId);
    if (isCoordinatorAgent(agent)) {
      return completeCoordinatorAgentRun(job, controller.signal);
    }

    const adapter = getAgentAdapter();
    await recordProgress(source, job.runId, {
      key: "context",
      title: "대화 맥락 정리",
      detail: "최근 메시지와 방 요약을 읽고 있습니다.",
    });
    const startupContext = await getRunStartupContext(job);
    await assertAgentRunActive(source, job.runId, controller.signal);
    await recordProgress(source, job.runId, {
      key: "memory",
      title: "장기 기억과 파일 확인",
      detail: "연결 가능한 메모리와 방 파일을 준비합니다.",
    });
    const memoryAttachments = await getRunMemoryAttachments(job);
    await assertAgentRunActive(source, job.runId, controller.signal);
    let emittedEventCount = 0;
    const onEvent = async (event: AgentStreamEvent) => {
      await assertAgentRunActive(source, job.runId, controller.signal);
      emittedEventCount += 1;
      await source.addAgentRunEvent(job.runId, event.type, event.payload);
    };
    await recordProgress(source, job.runId, {
      key: "agent",
      title: "봇에게 요청 전달",
      detail: "Claude 세션에서 작업을 시작합니다.",
    });
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
      signal: controller.signal,
      onEvent,
    });

    await assertAgentRunActive(source, job.runId, controller.signal);
    if (!emittedEventCount) {
      for (const event of result.events ?? []) {
        await source.addAgentRunEvent(job.runId, event.type, event.payload);
      }
    }

    await recordProgress(source, job.runId, {
      key: "save_response",
      title: "응답 저장",
      detail: "채팅창에 표시할 봇 메시지를 저장합니다.",
    });
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

    await assertAgentRunActive(source, job.runId, controller.signal);
    const completedRun = await source.updateAgentRun(job.runId, {
      status: result.requiresAction ? "requires_action" : "completed",
      anthropicSessionId: result.anthropicSessionId ?? null,
      outputMessageId: outputMessage.id,
      tokenUsage: result.tokenUsage ?? {},
      endedAt: new Date().toISOString(),
    });

    await recordProgress(source, job.runId, {
      key: "completed",
      title: result.requiresAction ? "추가 조치 대기" : "응답 완료",
      detail: result.requiresAction ? "봇이 추가 도구 결과를 기다리고 있습니다." : null,
    });

    await source.addAuditLog({
      actorUserId: job.userId,
      actorAgentId: auditActorAgentId(job.agentId),
      roomId: job.roomId,
      action: "agent.run.completed",
      targetType: "agent_run",
      targetId: job.runId,
    });

    await finalizeAgentRun(job.runId);
    return { run: completedRun, outputMessage };
  } catch (error) {
    if (await wasAgentRunCancelled(source, job.runId, controller.signal, error)) {
      const cancelledRun = await markAgentRunCancelled(source, job, "user_cancelled");
      await source.addAuditLog({
        actorUserId: job.userId,
        actorAgentId: auditActorAgentId(job.agentId),
        roomId: job.roomId,
        action: "agent.run.cancelled",
        targetType: "agent_run",
        targetId: job.runId,
      });
      return { run: cancelledRun, outputMessage: null };
    }
    await source.updateAgentRun(job.runId, {
      status: "failed",
      error: agentRunErrorMessage(error),
      endedAt: new Date().toISOString(),
    });
    await source.addAuditLog({
      actorUserId: job.userId,
      actorAgentId: auditActorAgentId(job.agentId),
      roomId: job.roomId,
      action: "agent.run.failed",
      targetType: "agent_run",
      targetId: job.runId,
      metadata: { error: error instanceof Error ? error.message : error },
    });
    throw error;
  } finally {
    activeAgentRunControllers.delete(job.runId);
  }
}

export async function cancelAgentRun(input: { userId: string; roomId: string; runId: string }) {
  const membership = await requireRoomMember(input.userId, input.roomId);
  if (!canWriteRoom(membership.role)) {
    throw new ForbiddenError("봇 실행을 중단할 권한이 없습니다.");
  }

  const source = getSource();
  const run = await getAgentRunById(source, input.runId);
  if (!run || run.roomId !== input.roomId) {
    const error = new Error("봇 실행을 찾을 수 없습니다.") as Error & { status: number };
    error.status = 404;
    throw error;
  }
  if (terminalAgentRunStatuses.has(run.status)) {
    return { run, cancelled: false };
  }

  const cancelledAt = new Date().toISOString();
  const updatedRun = await source.updateAgentRun(input.runId, {
    status: "cancelled",
    endedAt: cancelledAt,
    error: null,
    metadata: {
      ...run.metadata,
      cancelledAt,
      cancelledBy: input.userId,
    },
  });
  await recordProgress(source, input.runId, {
    key: "cancelled",
    title: "실행 중단됨",
    detail: "사용자가 채팅창에서 중단했습니다.",
  });
  activeAgentRunControllers.get(input.runId)?.abort();
  await source.addAuditLog({
    actorUserId: input.userId,
    roomId: input.roomId,
    action: "agent.run.cancelled",
    targetType: "agent_run",
    targetId: input.runId,
    metadata: { agentId: run.agentId, previousStatus: run.status },
  });

  return { run: updatedRun ?? run, cancelled: true };
}

async function completeCoordinatorAgentRun(job: AgentRunJob, signal: AbortSignal) {
  if (job.roomId !== "meeting") {
    throw new Error("총괄봇은 메인 회의방에서만 호출할 수 있습니다.");
  }
  const source = getSource();
  await assertAgentRunActive(source, job.runId, signal);
  await recordProgress(source, job.runId, {
    key: "coordinator_briefing",
    title: "방별 브리핑 종합",
    detail: "총괄봇이 업무방 보고를 모으고 있습니다.",
  });
  const snapshot = await generateCoordinatorBriefing({ userId: job.userId });
  await assertAgentRunActive(source, job.runId, signal);
  const coordinatorAgent = getCoordinatorAgent();
  const content = formatCoordinatorBriefingMessage(snapshot.briefing, snapshot.roomBriefings);

  const outputMessage = await source.createMessage({
    roomId: job.roomId,
    threadId: job.threadId,
    type: "guest_agent",
    content,
    senderUserId: null,
    senderAgentId: null,
    agentRunId: job.runId,
    metadata: {
      guestLabel: coordinatorAgent.name,
      coordinatorAgentId: coordinatorAgent.id,
      coordinatorBriefingId: snapshot.briefing?.id ?? null,
      sourceRoomBriefingIds: snapshot.roomBriefings.map((briefing) => briefing.id),
    },
  });

  await assertAgentRunActive(source, job.runId, signal);
  const completedRun = await source.updateAgentRun(job.runId, {
    status: "completed",
    outputMessageId: outputMessage.id,
    sessionSummary: snapshot.briefing?.summary ?? null,
    tokenUsage: {
      mode: "coordinator",
      roomBriefingCount: snapshot.roomBriefings.length,
      outputChars: content.length,
    },
    endedAt: new Date().toISOString(),
  });

  await recordProgress(source, job.runId, {
    key: "completed",
    title: "응답 완료",
    detail: null,
  });

  await source.addAuditLog({
    actorUserId: job.userId,
    roomId: job.roomId,
    action: "coordinator_agent.run.completed",
    targetType: "agent_run",
    targetId: job.runId,
    metadata: {
      coordinatorBriefingId: snapshot.briefing?.id ?? null,
      roomBriefingIds: snapshot.roomBriefings.map((briefing) => briefing.id),
    },
  });

  return { run: completedRun, outputMessage };
}

function formatCoordinatorBriefingMessage(briefing: CoordinatorBriefing | null, roomBriefings: RoomBriefing[]) {
  if (!briefing) {
    return "총괄 브리핑을 만들 수 없습니다. 방별 보고 데이터가 아직 없습니다.";
  }

  const highlights = briefing.roomHighlights
    .slice(0, 8)
    .map((item) => {
      const roomName = textValue(item.roomName, textValue(item.roomId, "업무방"));
      const taskCount = numberValue(item.taskCount);
      const riskCount = numberValue(item.riskCount);
      const summary = textValue(item.summary, "요약 대기 중");
      return `- ${roomName}: 할 일 ${taskCount}개, 위험 ${riskCount}개. ${summary}`;
    })
    .join("\n");
  const risks = briefing.crossRoomRisks.length
    ? briefing.crossRoomRisks
        .slice(0, 5)
        .map((item) => `- ${textValue(item.roomName, "업무방")}: ${textValue(item.title, textValue(item.type, "위험 신호"))}`)
        .join("\n")
    : "- 현재 구조화 보고 기준의 공통 위험 신호는 없습니다.";
  const nextActions = briefing.nextActions.length
    ? briefing.nextActions
        .slice(0, 5)
        .map((item) => `- ${textValue(item.roomName, "업무방")}: ${textValue(item.title, "다음 행동 확인")}`)
        .join("\n")
    : "- 새로 지정할 다음 행동은 없습니다.";
  const decisionsNeeded = briefing.decisionsNeeded.length
    ? briefing.decisionsNeeded
        .slice(0, 4)
        .map((item) => `- ${textValue(item.title, "결정 필요 항목")}`)
        .join("\n")
    : "- 메인 회의방에서 즉시 결정해야 할 항목은 없습니다.";

  return [
    "**총괄 브리핑**",
    briefing.summary,
    "",
    `**방별 현황 (${roomBriefings.length}개 방)**`,
    highlights || "- 보고할 업무방이 없습니다.",
    "",
    "**위험/병목**",
    risks,
    "",
    "**결정 필요**",
    decisionsNeeded,
    "",
    "**다음 행동**",
    nextActions,
  ].join("\n");
}

function auditActorAgentId(agentId: string) {
  return agentId === getCoordinatorAgent().id ? undefined : agentId;
}

function textValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

async function recordProgress(
  source: AgentRunSource,
  agentRunId: string,
  progress: { key: string; title: string; detail?: string | null },
) {
  await source.addAgentRunEvent(agentRunId, AGENT_RUN_PROGRESS_EVENT, agentRunProgressPayload(progress));
}

async function getAgentRunById(source: AgentRunSource, runId: string) {
  return (await source.listAgentRuns()).find((item) => item.id === runId) ?? null;
}

async function assertAgentRunActive(source: AgentRunSource, runId: string, signal: AbortSignal) {
  if (signal.aborted) {
    throw new AgentRunCancelledError();
  }

  const run = await getAgentRunById(source, runId);
  if (!run) {
    throw new Error("봇 실행을 찾을 수 없습니다.");
  }
  if (run.status === "cancelled") {
    throw new AgentRunCancelledError();
  }
  return run;
}

async function wasAgentRunCancelled(
  source: AgentRunSource,
  runId: string,
  signal: AbortSignal,
  error: unknown,
) {
  if (error instanceof AgentRunCancelledError) {
    return true;
  }
  if (signal.aborted) {
    return true;
  }
  return (await getAgentRunById(source, runId))?.status === "cancelled";
}

async function markAgentRunCancelled(source: AgentRunSource, job: AgentRunJob, reason: string) {
  const run = await getAgentRunById(source, job.runId);
  if (!run) {
    throw new Error("봇 실행을 찾을 수 없습니다.");
  }
  if (run.status === "cancelled" || terminalAgentRunStatuses.has(run.status)) {
    return run;
  }

  const cancelledAt = new Date().toISOString();
  const updatedRun = await source.updateAgentRun(job.runId, {
    status: "cancelled",
    endedAt: cancelledAt,
    error: null,
    metadata: {
      ...run.metadata,
      cancelledAt,
      cancelledBy: job.userId,
      cancellationReason: reason,
    },
  });
  await recordProgress(source, job.runId, {
    key: "cancelled",
    title: "실행 중단됨",
    detail: "사용자가 채팅창에서 중단했습니다.",
  });
  return updatedRun ?? run;
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
