import "server-only";

import {
  agents as seedAgents,
  allowedUsers as seedAllowedUsers,
  baseMemories,
  memberships as seedMemberships,
  mockUser,
  rooms as seedRooms,
} from "@/lib/mock-data";
import type {
  AgentRun,
  AgentRunEvent,
  AuditLog,
  Decision,
  DomainMemory,
  FileRecord,
  MeetingImport,
  MemoryWriteReview,
  RoomMessage,
  SharedItem,
  Task,
  UserProfile,
  VideoMeeting,
  VideoMeetingArtifact,
  VideoMeetingEvent,
} from "@/types/domain";

type MockState = {
  messages: RoomMessage[];
  agentRuns: AgentRun[];
  agentRunEvents: AgentRunEvent[];
  memories: DomainMemory[];
  sharedItems: SharedItem[];
  imports: MeetingImport[];
  files: FileRecord[];
  decisions: Decision[];
  tasks: Task[];
  auditLogs: AuditLog[];
  memoryReviews: MemoryWriteReview[];
  videoMeetings: VideoMeeting[];
  videoArtifacts: VideoMeetingArtifact[];
  videoEvents: VideoMeetingEvent[];
};

const globalKey = "__schoolx_mock_state__";

function id() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

function initialMessages(): RoomMessage[] {
  return [
    {
      id: id(),
      roomId: "meeting",
      senderUserId: null,
      senderAgentId: null,
      agentRunId: null,
      type: "system",
      content: "메인 회의방이 준비되었습니다. 업무방 산출물과 게스트 봇 브리핑이 이곳에 모입니다.",
      metadata: {},
      createdAt: now(),
    },
    {
      id: id(),
      roomId: "finance",
      senderUserId: mockUser.userId,
      senderAgentId: null,
      agentRunId: null,
      type: "human",
      content: "과학관 과제 예산 초안을 회의방에 공유할 준비가 필요합니다.",
      metadata: {},
      createdAt: now(),
    },
  ];
}

function initialState(): MockState {
  return {
    messages: initialMessages(),
    agentRuns: [],
    agentRunEvents: [],
    memories: structuredClone(baseMemories),
    sharedItems: [],
    imports: [],
    files: [
      {
        id: id(),
        storagePath: "meeting/2026-05/sample-minutes.md",
        originalName: "5월 정기회의 메모.md",
        uploadedBy: mockUser.userId,
        sizeBytes: 4180,
        mimeType: "text/markdown",
        checksum: null,
        createdAt: now(),
        versionNo: 1,
        accessLevel: "owner",
      },
    ],
    decisions: [
      {
        id: id(),
        roomId: "meeting",
        sourceMessageId: null,
        title: "회의방은 공유/반입의 기준 허브로 운영",
        description: "업무방 산출물은 shared_items로 올리고, 업무방 반영은 meeting_imports로 추적합니다.",
        decidedBy: mockUser.userId,
        createdAt: now(),
      },
    ],
    tasks: [
      {
        id: id(),
        roomId: "development",
        decisionId: null,
        title: "Supabase RLS와 service-role 경계 점검",
        description: "운영 전 보안 리뷰 체크리스트를 확인합니다.",
        assigneeUserId: mockUser.userId,
        assigneeRoomId: "development",
        status: "todo",
        dueAt: null,
        createdBy: mockUser.userId,
        createdAt: now(),
        updatedAt: now(),
      },
    ],
    auditLogs: [],
    memoryReviews: [],
    videoMeetings: [],
    videoArtifacts: [],
    videoEvents: [],
  };
}

function state(): MockState {
  const root = globalThis as typeof globalThis & Record<string, MockState | undefined>;
  root[globalKey] ??= initialState();
  return root[globalKey]!;
}

export const mockStore = {
  currentUser(): UserProfile {
    return mockUser;
  },

  listRooms() {
    return seedRooms;
  },

  getRoom(roomId: string) {
    return seedRooms.find((room) => room.id === roomId) ?? null;
  },

  listAgents() {
    return seedAgents;
  },

  getAgentByRoom(roomId: string) {
    return seedAgents.find((agent) => agent.roomId === roomId) ?? null;
  },

  getAgent(agentId: string) {
    return seedAgents.find((agent) => agent.id === agentId) ?? null;
  },

  listAllowedUsers() {
    return seedAllowedUsers;
  },

  listUserProfiles() {
    return [mockUser];
  },

  listMemberships() {
    return seedMemberships;
  },

  getMembership(userId: string, roomId: string) {
    if (roomId === "meeting") {
      return seedMemberships.find((membership) => membership.userId === userId && membership.roomId === "meeting") ?? null;
    }
    return seedMemberships.find((membership) => membership.userId === userId && membership.roomId === roomId) ?? null;
  },

  listMessages(roomId: string) {
    return state()
      .messages.filter((message) => message.roomId === roomId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  createMessage(input: Pick<RoomMessage, "roomId" | "type" | "content"> & Partial<RoomMessage>) {
    const message: RoomMessage = {
      id: id(),
      senderUserId: input.senderUserId ?? mockUser.userId,
      senderAgentId: input.senderAgentId ?? null,
      agentRunId: input.agentRunId ?? null,
      metadata: input.metadata ?? {},
      createdAt: now(),
      roomId: input.roomId,
      type: input.type,
      content: input.content,
    };
    state().messages.push(message);
    return message;
  },

  createAgentRun(input: Omit<AgentRun, "id" | "startedAt" | "tokenUsage" | "metadata" | "status"> & Partial<AgentRun>) {
    const run: AgentRun = {
      id: id(),
      roomId: input.roomId,
      agentId: input.agentId ?? null,
      initiatedBy: input.initiatedBy ?? mockUser.userId,
      anthropicSessionId: input.anthropicSessionId ?? null,
      mode: input.mode,
      runType: input.runType,
      guestSourceRoomId: input.guestSourceRoomId ?? null,
      status: input.status ?? "queued",
      inputMessageId: input.inputMessageId ?? null,
      outputMessageId: input.outputMessageId ?? null,
      sessionSummary: input.sessionSummary ?? null,
      tokenUsage: input.tokenUsage ?? {},
      error: input.error ?? null,
      startedAt: now(),
      endedAt: input.endedAt ?? null,
      metadata: input.metadata ?? {},
    };
    state().agentRuns.push(run);
    return run;
  },

  updateAgentRun(runId: string, patch: Partial<AgentRun>) {
    const run = state().agentRuns.find((item) => item.id === runId);
    if (!run) {
      return null;
    }
    Object.assign(run, patch);
    return run;
  },

  listAgentRuns() {
    return [...state().agentRuns].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  },

  addAgentRunEvent(agentRunId: string, eventType: string, payload: Record<string, unknown>) {
    const event: AgentRunEvent = {
      id: id(),
      agentRunId,
      anthropicEventId: null,
      eventType,
      payload,
      createdAt: now(),
    };
    state().agentRunEvents.push(event);
    return event;
  },

  listAgentRunEvents(agentRunId?: string) {
    return state().agentRunEvents.filter((event) => !agentRunId || event.agentRunId === agentRunId);
  },

  getMemory(roomId: string) {
    return state().memories.find((memory) => memory.roomId === roomId) ?? null;
  },

  updateMemory(roomId: string, patch: Partial<DomainMemory>) {
    const memory = this.getMemory(roomId);
    if (!memory) {
      return null;
    }
    Object.assign(memory, patch, { updatedAt: now() });
    return memory;
  },

  appendPendingContext(roomId: string, context: Record<string, unknown>) {
    const memory = this.getMemory(roomId);
    if (!memory) {
      return null;
    }
    memory.pendingContext.push({ id: id(), ...context, createdAt: now() });
    memory.updatedAt = now();
    return memory;
  },

  markPendingProcessed(roomId: string, contextIds: string[]) {
    const memory = this.getMemory(roomId);
    if (!memory) {
      return null;
    }
    const moving = memory.pendingContext.filter((context) => contextIds.includes(String(context.id)));
    memory.pendingContext = memory.pendingContext.filter((context) => !contextIds.includes(String(context.id)));
    memory.processedContext.push(...moving.map((context) => ({ ...context, processedAt: now() })));
    memory.updatedAt = now();
    return memory;
  },

  listFiles(roomId: string) {
    return state().files.filter((file) => file.storagePath.startsWith(`${roomId}/`) || roomId === "meeting");
  },

  addFile(input: Omit<FileRecord, "id" | "createdAt" | "versionNo" | "accessLevel"> & Partial<FileRecord>) {
    const file: FileRecord = {
      id: id(),
      storagePath: input.storagePath,
      originalName: input.originalName,
      uploadedBy: input.uploadedBy ?? mockUser.userId,
      sizeBytes: input.sizeBytes ?? 0,
      mimeType: input.mimeType ?? "application/octet-stream",
      checksum: input.checksum ?? null,
      createdAt: now(),
      versionNo: input.versionNo ?? 1,
      accessLevel: input.accessLevel ?? "owner",
    };
    state().files.push(file);
    return file;
  },

  listSharedItems(roomId?: string) {
    return state().sharedItems.filter(
      (item) => !roomId || item.targetRoomId === roomId || item.sourceRoomId === roomId,
    );
  },

  createSharedItem(input: Omit<SharedItem, "id" | "createdAt" | "metadata" | "targetRoomId"> & Partial<SharedItem>) {
    const item: SharedItem = {
      id: id(),
      sourceRoomId: input.sourceRoomId,
      targetRoomId: input.targetRoomId ?? "meeting",
      sourceMessageId: input.sourceMessageId ?? null,
      sourceFileId: input.sourceFileId ?? null,
      title: input.title,
      summary: input.summary,
      sharedBy: input.sharedBy ?? mockUser.userId,
      createdAt: now(),
      metadata: input.metadata ?? {},
    };
    state().sharedItems.push(item);
    return item;
  },

  listImports(roomId?: string) {
    return state().imports.filter((item) => !roomId || item.targetRoomId === roomId || item.meetingRoomId === roomId);
  },

  createImport(input: Omit<MeetingImport, "id" | "createdAt" | "metadata" | "meetingRoomId" | "status"> & Partial<MeetingImport>) {
    const item: MeetingImport = {
      id: id(),
      meetingRoomId: input.meetingRoomId ?? "meeting",
      targetRoomId: input.targetRoomId,
      sharedItemId: input.sharedItemId ?? null,
      sourceMessageId: input.sourceMessageId ?? null,
      sourceFileId: input.sourceFileId ?? null,
      importedBy: input.importedBy ?? mockUser.userId,
      status: input.status ?? "pending",
      createdAt: now(),
      metadata: input.metadata ?? {},
    };
    state().imports.push(item);
    this.appendPendingContext(item.targetRoomId, {
      type: "meeting_import",
      meetingImportId: item.id,
      title: "회의방에서 가져온 맥락",
      summary: item.metadata.summary ?? "회의방 항목을 업무방에 반영해야 합니다.",
    });
    return item;
  },

  listDecisions(roomId?: string) {
    return state().decisions.filter((decision) => !roomId || decision.roomId === roomId);
  },

  createDecision(input: Omit<Decision, "id" | "createdAt"> & Partial<Decision>) {
    const decision: Decision = {
      id: id(),
      roomId: input.roomId,
      sourceMessageId: input.sourceMessageId ?? null,
      title: input.title,
      description: input.description ?? null,
      decidedBy: input.decidedBy ?? mockUser.userId,
      createdAt: now(),
    };
    state().decisions.push(decision);
    return decision;
  },

  listTasks(roomId?: string) {
    return state().tasks.filter((task) => !roomId || task.roomId === roomId || task.assigneeRoomId === roomId);
  },

  createTask(input: Omit<Task, "id" | "createdAt" | "updatedAt" | "status"> & Partial<Task>) {
    const task: Task = {
      id: id(),
      roomId: input.roomId,
      decisionId: input.decisionId ?? null,
      title: input.title,
      description: input.description ?? null,
      assigneeUserId: input.assigneeUserId ?? null,
      assigneeRoomId: input.assigneeRoomId ?? null,
      status: input.status ?? "todo",
      dueAt: input.dueAt ?? null,
      createdBy: input.createdBy ?? mockUser.userId,
      createdAt: now(),
      updatedAt: now(),
    };
    state().tasks.push(task);
    return task;
  },

  addAuditLog(input: Omit<AuditLog, "id" | "createdAt" | "metadata"> & Partial<AuditLog>) {
    const log: AuditLog = {
      id: id(),
      actorUserId: input.actorUserId ?? mockUser.userId,
      actorAgentId: input.actorAgentId ?? null,
      roomId: input.roomId ?? null,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      metadata: input.metadata ?? {},
      createdAt: now(),
    };
    state().auditLogs.push(log);
    return log;
  },

  listAuditLogs() {
    return [...state().auditLogs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  listMemoryReviews() {
    return state().memoryReviews;
  },

  addMemoryReview(input: Omit<MemoryWriteReview, "id" | "createdAt" | "status"> & Partial<MemoryWriteReview>) {
    const review: MemoryWriteReview = {
      id: id(),
      roomId: input.roomId,
      agentRunId: input.agentRunId ?? null,
      proposedMemory: input.proposedMemory,
      status: input.status ?? "pending",
      reviewedBy: input.reviewedBy ?? null,
      reviewedAt: input.reviewedAt ?? null,
      createdAt: now(),
    };
    state().memoryReviews.push(review);
    return review;
  },

  listVideoMeetings(roomId?: string, status?: string) {
    return state().videoMeetings.filter(
      (meeting) => (!roomId || meeting.roomId === roomId) && (!status || meeting.status === status),
    );
  },

  getVideoMeeting(meetingId: string) {
    return state().videoMeetings.find((meeting) => meeting.id === meetingId) ?? null;
  },

  createVideoMeeting(input: Omit<VideoMeeting, "id" | "createdAt" | "updatedAt" | "status" | "embedAllowed" | "metadata"> & Partial<VideoMeeting>) {
    const meeting: VideoMeeting = {
      id: id(),
      roomId: input.roomId,
      provider: input.provider,
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? "scheduled",
      providerSpaceName: input.providerSpaceName ?? null,
      providerConferenceName: input.providerConferenceName ?? null,
      providerMeetingId: input.providerMeetingId ?? null,
      providerMeetingCode: input.providerMeetingCode ?? null,
      joinUrl: input.joinUrl ?? null,
      hostUrl: input.hostUrl ?? null,
      embedAllowed: input.embedAllowed ?? false,
      scheduledStartAt: input.scheduledStartAt ?? null,
      startedAt: input.startedAt ?? null,
      endedAt: input.endedAt ?? null,
      createdBy: input.createdBy ?? mockUser.userId,
      endedBy: input.endedBy ?? null,
      consentRecording: input.consentRecording ?? false,
      consentTranscript: input.consentTranscript ?? false,
      consentAiSummary: input.consentAiSummary ?? true,
      metadata: input.metadata ?? {},
      createdAt: now(),
      updatedAt: now(),
    };
    state().videoMeetings.push(meeting);
    return meeting;
  },

  updateVideoMeeting(meetingId: string, patch: Partial<VideoMeeting>) {
    const meeting = this.getVideoMeeting(meetingId);
    if (!meeting) {
      return null;
    }
    Object.assign(meeting, patch, { updatedAt: now() });
    return meeting;
  },

  addVideoArtifact(input: Omit<VideoMeetingArtifact, "id" | "createdAt" | "status" | "metadata"> & Partial<VideoMeetingArtifact>) {
    const artifact: VideoMeetingArtifact = {
      id: id(),
      videoMeetingId: input.videoMeetingId,
      artifactType: input.artifactType,
      title: input.title,
      content: input.content ?? null,
      externalUrl: input.externalUrl ?? null,
      fileId: input.fileId ?? null,
      providerArtifactName: input.providerArtifactName ?? null,
      status: input.status ?? "available",
      createdBy: input.createdBy ?? mockUser.userId,
      metadata: input.metadata ?? {},
      createdAt: now(),
    };
    state().videoArtifacts.push(artifact);
    return artifact;
  },

  listVideoArtifacts(meetingId: string) {
    return state().videoArtifacts.filter((artifact) => artifact.videoMeetingId === meetingId);
  },

  addVideoEvent(input: Omit<VideoMeetingEvent, "id" | "createdAt" | "payload"> & Partial<VideoMeetingEvent>) {
    const event: VideoMeetingEvent = {
      id: id(),
      videoMeetingId: input.videoMeetingId,
      roomId: input.roomId,
      eventType: input.eventType,
      actorUserId: input.actorUserId ?? mockUser.userId,
      payload: input.payload ?? {},
      createdAt: now(),
    };
    state().videoEvents.push(event);
    return event;
  },

  listVideoEvents(meetingId?: string) {
    return state().videoEvents.filter((event) => !meetingId || event.videoMeetingId === meetingId);
  },
};
