import "server-only";

import {
  DEVELOPMENT_AGENT_ID,
  DEVELOPMENT_AGENT_ROOM_ID,
  isDevelopmentAgent,
} from "@/lib/agents/development-agent";
import type { Agent, AgentRun, AuditLog, Room, RoomMessage, RoomThread, UserProfile } from "@/types/domain";

const DEVELOPMENT_REQUEST_THREAD_KIND = "development_request_inbox";
const DEVELOPMENT_REQUEST_THREAD_TITLE = "개발 요청 접수함";

type DevelopmentMirrorSource = {
  getRoom: (roomId: string) => Room | null | Promise<Room | null>;
  listThreads: (roomId: string) => RoomThread[] | Promise<RoomThread[]>;
  createThread: (
    input: Pick<RoomThread, "roomId" | "title"> & Partial<RoomThread>,
  ) => RoomThread | Promise<RoomThread>;
  listUserProfiles: () => UserProfile[] | Promise<UserProfile[]>;
  listAgentRuns: () => AgentRun[] | Promise<AgentRun[]>;
  listMessages: (roomId: string, threadId?: string | null) => RoomMessage[] | Promise<RoomMessage[]>;
  createMessage: (
    input: Pick<RoomMessage, "roomId" | "type" | "content"> & Partial<RoomMessage>,
  ) => RoomMessage | Promise<RoomMessage>;
  updateAgentRun: (runId: string, patch: Partial<AgentRun>) => AgentRun | null | Promise<AgentRun | null>;
  addAuditLog: (
    input: Omit<AuditLog, "id" | "createdAt" | "metadata"> & Partial<AuditLog>,
  ) => AuditLog | Promise<AuditLog>;
};

export async function mirrorDevelopmentAgentRequest(input: {
  source: DevelopmentMirrorSource;
  agent: Pick<Agent, "id" | "roomId" | "name">;
  run: AgentRun;
  userId?: string | null;
  sourceRoomId: string;
  sourceThreadId: string;
  inputMessage: RoomMessage;
}) {
  if (!isDevelopmentAgent(input.agent) || input.agent.roomId === input.sourceRoomId) {
    return input.run;
  }

  const developmentRoomId = input.agent.roomId || DEVELOPMENT_AGENT_ROOM_ID;
  const [developmentRoom, sourceRoom, profiles, existingDevelopmentMessages] = await Promise.all([
    input.source.getRoom(developmentRoomId),
    input.source.getRoom(input.sourceRoomId),
    input.source.listUserProfiles(),
    input.source.listMessages(developmentRoomId),
  ]);
  if (!developmentRoom?.isActive) {
    return input.run;
  }

  const existingMirror = existingDevelopmentMessages.find(
    (message) => message.metadata.sourceAgentRunId === input.run.id,
  );
  if (existingMirror) {
    return updateRunMirrorMetadata(input.source, input.run, existingMirror);
  }

  const sourceRoomName = sourceRoom?.name ?? input.sourceRoomId;
  const userProfile = profiles.find((profile) => profile.userId === input.userId);
  const requesterName = userProfile?.displayName ?? "구성원";
  const requesterUserId = input.userId ?? null;
  const developmentThread = await ensureDevelopmentRequestThread(input.source, developmentRoomId);
  const requestIntent = input.run.metadata.requestIntent === "development_request" ? "development_request" : null;
  const content = [
    "[개발 요청 접수]",
    "",
    input.inputMessage.content,
    "",
    `원본 방: ${sourceRoomName}`,
    `요청자: ${requesterName}`,
    requestIntent ? "접수 방식: 개발봇 토글" : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  const mirrorMessage = await input.source.createMessage({
    roomId: developmentRoomId,
    threadId: developmentThread.id,
    type: "agent",
    content,
    senderUserId: null,
    senderAgentId: input.agent.id,
    agentRunId: input.run.id,
    metadata: {
      developmentRequestMirror: true,
      sourceRoomId: input.sourceRoomId,
      sourceRoomName,
      sourceThreadId: input.sourceThreadId,
      sourceMessageId: input.inputMessage.id,
      sourceAgentRunId: input.run.id,
      initiatedBy: requesterUserId,
      requesterUserId,
      requesterName,
      requestIntent,
    },
  });
  await input.source.addAuditLog({
    actorUserId: input.userId ?? null,
    actorAgentId: input.agent.id,
    roomId: developmentRoomId,
    action: "development_agent.request_mirrored",
    targetType: "room_message",
    targetId: mirrorMessage.id,
    metadata: {
      sourceRoomId: input.sourceRoomId,
      sourceThreadId: input.sourceThreadId,
      sourceMessageId: input.inputMessage.id,
      agentRunId: input.run.id,
      requesterUserId,
      requesterName,
    },
  });

  return updateRunMirrorMetadata(input.source, input.run, mirrorMessage);
}

export async function backfillDevelopmentAgentRequestMirrors(input: {
  source: DevelopmentMirrorSource;
  limit?: number;
}) {
  const developmentRoom = await input.source.getRoom(DEVELOPMENT_AGENT_ROOM_ID);
  if (!developmentRoom?.isActive) {
    return { created: 0, skipped: 0 };
  }

  const [runs, developmentMessages] = await Promise.all([
    input.source.listAgentRuns(),
    input.source.listMessages(DEVELOPMENT_AGENT_ROOM_ID),
  ]);
  const mirroredRunIds = new Set(
    developmentMessages
      .map((message) => message.metadata.sourceAgentRunId)
      .filter((runId): runId is string => typeof runId === "string"),
  );

  const candidates = runs
    .filter(isExternalDevelopmentAgentRun)
    .filter((run) => run.inputMessageId && !run.metadata.developmentRoomMirrorMessageId && !mirroredRunIds.has(run.id))
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .slice(-(input.limit ?? 100));

  let created = 0;
  let skipped = 0;
  for (const run of candidates) {
    const sourceMessages = await input.source.listMessages(run.roomId, run.threadId);
    const inputMessage = sourceMessages.find((message) => message.id === run.inputMessageId);
    if (!inputMessage) {
      skipped += 1;
      continue;
    }

    // candidates는 미러가 없는 run만 골라낸 것이므로, 미러 메시지 id가 채워지면 곧 신규 생성이다.
    // (이전에는 매 candidate마다 development 방 메시지를 before/after 두 번 더 조회해 비교했다.)
    const updatedRun = await mirrorDevelopmentAgentRequest({
      source: input.source,
      agent: {
        id: run.agentId ?? DEVELOPMENT_AGENT_ID,
        roomId: DEVELOPMENT_AGENT_ROOM_ID,
        name: "개발봇",
      },
      run,
      userId: run.initiatedBy ?? inputMessage.senderUserId ?? null,
      sourceRoomId: run.roomId,
      sourceThreadId: run.threadId,
      inputMessage,
    });
    if (updatedRun.metadata.developmentRoomMirrorMessageId) {
      created += 1;
    } else {
      skipped += 1;
    }
  }

  return { created, skipped };
}

async function ensureDevelopmentRequestThread(source: DevelopmentMirrorSource, roomId: string) {
  const threads = await source.listThreads(roomId);
  const existing = threads.find(
    (thread) =>
      thread.metadata.kind === DEVELOPMENT_REQUEST_THREAD_KIND || thread.title === DEVELOPMENT_REQUEST_THREAD_TITLE,
  );
  if (existing) {
    return existing;
  }

  return source.createThread({
    roomId,
    title: DEVELOPMENT_REQUEST_THREAD_TITLE,
    summary: "다른 방에서 개발봇을 호출해 접수된 개발 요청을 모으는 대화입니다.",
    carryoverSummary: "",
    status: "active",
    createdBy: null,
    metadata: { kind: DEVELOPMENT_REQUEST_THREAD_KIND },
  });
}

async function updateRunMirrorMetadata(
  source: DevelopmentMirrorSource,
  run: AgentRun,
  mirrorMessage: RoomMessage,
) {
  const updatedRun = await source.updateAgentRun(run.id, {
    metadata: {
      ...run.metadata,
      developmentRoomMirrorMessageId: mirrorMessage.id,
      developmentRoomMirrorThreadId: mirrorMessage.threadId,
    },
  });
  return updatedRun ?? run;
}

function isExternalDevelopmentAgentRun(run: AgentRun) {
  return (
    run.roomId !== DEVELOPMENT_AGENT_ROOM_ID &&
    (run.agentId === DEVELOPMENT_AGENT_ID || run.guestSourceRoomId === DEVELOPMENT_AGENT_ROOM_ID)
  );
}
