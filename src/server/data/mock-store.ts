import "server-only";

import {
  agents as seedAgents,
  allowedUsers as seedAllowedUsers,
  baseMemories,
  memberships as seedMemberships,
  mockUser,
  rooms as seedRooms,
} from "@/lib/mock-data";
import { COORDINATOR_AGENT_ID, getCoordinatorAgent } from "@/lib/agents/development-agent";
import type {
  Agent,
  AgentPersona,
  AgentPersonaVersion,
  AgentRun,
  AgentRunEvent,
  AllowedUser,
  AuditLog,
  CoordinatorBriefing,
  Decision,
  DomainMemory,
  FileRecord,
  MeetingImport,
  MemoryWriteReview,
  PendingRoomMembership,
  RoomBriefing,
  RoomMembership,
  RoomMemoryStore,
  RoomMessage,
  RoomThread,
  SharedItem,
  Task,
  UserProfile,
  VideoMeeting,
  VideoMeetingArtifact,
  VideoMeetingEvent,
} from "@/types/domain";

type MockIntegrationToken = {
  provider: string;
  refreshToken?: string | null;
  accessToken?: string | null;
  expiresAt?: string | null;
  scope?: string | null;
  tokenType?: string | null;
  connectedBy?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

type MockState = {
  threads: RoomThread[];
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
  pendingMemberships: PendingRoomMembership[];
  memoryStores: RoomMemoryStore[];
  videoMeetings: VideoMeeting[];
  videoArtifacts: VideoMeetingArtifact[];
  videoEvents: VideoMeetingEvent[];
  roomBriefings: RoomBriefing[];
  coordinatorBriefings: CoordinatorBriefing[];
  removedFileAccess: Array<{ roomId: string; fileId: string }>;
  sharedFileAccess: Array<{ roomId: string; fileId: string; accessLevel: FileRecord["accessLevel"] }>;
  integrationTokens: MockIntegrationToken[];
};

const globalKey = "__schoolx_mock_state__";

function id() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

function isTaskVisibleInRoom(task: Task, roomId: string) {
  return task.roomId === roomId || task.assigneeRoomId === roomId;
}

function initialThreads(): RoomThread[] {
  return seedRooms.map((room) => ({
    id: `${room.id}-thread-default`,
    roomId: room.id,
    title: `${room.name} 기본 대화`,
    summary: `${room.name} 방의 기본 대화입니다.`,
    carryoverSummary: "",
    status: "active",
    lastMessageAt: now(),
    createdBy: mockUser.userId,
    createdAt: now(),
    updatedAt: now(),
    metadata: { kind: "default" },
  }));
}

function initialMessages(threads: RoomThread[]): RoomMessage[] {
  const threadId = (roomId: string) => threads.find((thread) => thread.roomId === roomId)?.id ?? `${roomId}-thread-default`;
  return [
    {
      id: id(),
      roomId: "meeting",
      threadId: threadId("meeting"),
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
      threadId: threadId("finance"),
      senderUserId: mockUser.userId,
      senderAgentId: null,
      agentRunId: null,
      type: "human",
      content: "과학관 AI교육 연구회 예산 초안을 회의방에 공유할 준비가 필요합니다.",
      metadata: {},
      createdAt: now(),
    },
  ];
}

function initialState(): MockState {
  const threads = initialThreads();
  return {
    threads,
    messages: initialMessages(threads),
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
        metadata: {},
      },
    ],
    auditLogs: [],
    memoryReviews: [],
    pendingMemberships: [],
    memoryStores: seedRooms.map((room) => ({
      id: `${room.id}-memory-store-link`,
      roomId: room.id,
      anthropicMemoryStoreId: null,
      accessMode: "read_write",
      purpose: `${room.name} Claude Memory Store placeholder`,
      createdAt: now(),
      updatedAt: now(),
    })),
    videoMeetings: [],
    videoArtifacts: [],
    videoEvents: [],
    roomBriefings: [],
    coordinatorBriefings: [],
    removedFileAccess: [],
    sharedFileAccess: [],
    integrationTokens: [],
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
    return seedRooms.filter((room) => room.isActive);
  },

  getRoom(roomId: string) {
    return seedRooms.find((room) => room.id === roomId) ?? null;
  },

  listAgents() {
    return seedAgents.filter((agent) => agent.isActive);
  },

  getAgentByRoom(roomId: string) {
    return seedAgents.find((agent) => agent.roomId === roomId) ?? null;
  },

  getAgent(agentId: string) {
    if (agentId === COORDINATOR_AGENT_ID) {
      return getCoordinatorAgent();
    }
    return seedAgents.find((agent) => agent.id === agentId) ?? null;
  },

  updateAgentPersona(
    agentId: string,
    input: {
      personaDraft?: AgentPersona;
      personaPublished?: AgentPersona;
      updatedBy?: string | null;
      publishedBy?: string | null;
      metadata?: Record<string, unknown>;
      anthropicAgentVersion?: number | null;
    },
  ) {
    const agent = seedAgents.find((item) => item.id === agentId) as Agent | undefined;
    if (!agent) {
      throw new Error("봇을 찾을 수 없습니다.");
    }
    const timestamp = now();
    agent.personaDraft = input.personaDraft ?? agent.personaDraft;
    agent.personaPublished = input.personaPublished ?? agent.personaPublished;
    agent.personaDraftUpdatedBy = input.personaDraft ? input.updatedBy ?? null : agent.personaDraftUpdatedBy ?? null;
    agent.personaDraftUpdatedAt = input.personaDraft ? timestamp : agent.personaDraftUpdatedAt ?? null;
    agent.personaPublishedBy = input.personaPublished ? input.publishedBy ?? null : agent.personaPublishedBy ?? null;
    agent.personaPublishedAt = input.personaPublished ? timestamp : agent.personaPublishedAt ?? null;
    if (input.personaPublished) {
      agent.systemPrompt = input.personaPublished.role;
      agent.guestPrompt = input.personaPublished.guestPrompt;
    }
    agent.metadata = {
      ...agent.metadata,
      ...(input.metadata ?? {}),
      persona_draft: agent.personaDraft,
      persona_published: agent.personaPublished,
      anthropic_agent_version: input.anthropicAgentVersion ?? agent.metadata.anthropic_agent_version ?? null,
    };
    agent.updatedAt = timestamp;
    return agent;
  },

  addAgentPersonaVersion(
    input: Pick<AgentPersonaVersion, "agentId" | "roomId" | "persona" | "versionNo"> &
      Partial<Omit<AgentPersonaVersion, "id" | "createdAt">>,
  ) {
    return {
      id: id(),
      agentId: input.agentId,
      roomId: input.roomId,
      versionNo: input.versionNo,
      persona: input.persona,
      anthropicAgentId: input.anthropicAgentId ?? null,
      anthropicAgentVersion: input.anthropicAgentVersion ?? null,
      publishedBy: input.publishedBy ?? null,
      createdAt: now(),
      metadata: input.metadata ?? {},
    } satisfies AgentPersonaVersion;
  },

  listAllowedUsers() {
    return seedAllowedUsers;
  },

  getAllowedUser(email: string) {
    return seedAllowedUsers.find((user) => user.email === email.toLowerCase()) ?? null;
  },

  updateAllowedUser(email: string, patch: { isActive?: boolean; isAdmin?: boolean; notes?: string | null }) {
    const user = seedAllowedUsers.find((item) => item.email === email.toLowerCase());
    if (!user) {
      return null;
    }
    if (typeof patch.isActive === "boolean") {
      user.isActive = patch.isActive;
    }
    if (typeof patch.isAdmin === "boolean") {
      user.isAdmin = patch.isAdmin;
    }
    if ("notes" in patch) {
      user.notes = patch.notes ?? null;
    }
    return user;
  },

  upsertAllowedUser(input: {
    email: string;
    invitedBy?: string | null;
    notes?: string | null;
    isActive?: boolean;
    isAdmin?: boolean;
  }) {
    const email = input.email.toLowerCase();
    const existing = seedAllowedUsers.find((user) => user.email === email);
    if (existing) {
      if (input.invitedBy !== undefined) {
        existing.invitedBy = input.invitedBy;
      }
      if (input.notes !== undefined) {
        existing.notes = input.notes;
      }
      existing.isActive = input.isActive ?? true;
      existing.isAdmin = input.isAdmin ?? false;
      return existing;
    }
    const user: AllowedUser = {
      email,
      invitedBy: input.invitedBy ?? null,
      invitedAt: now(),
      notes: input.notes ?? null,
      isActive: input.isActive ?? true,
      isAdmin: input.isAdmin ?? false,
    };
    seedAllowedUsers.push(user);
    return user;
  },

  listUserProfiles() {
    return [mockUser];
  },

  getUserProfileByEmail(email: string) {
    return [mockUser].find((profile) => profile.email.toLowerCase() === email.toLowerCase()) ?? null;
  },

  updateUserProfile(
    userId: string,
    patch: {
      displayName: string;
      avatarUrl?: string | null;
      bio?: string | null;
    },
  ) {
    if (mockUser.userId !== userId) {
      return null;
    }
    mockUser.displayName = patch.displayName;
    mockUser.avatarUrl = patch.avatarUrl ?? null;
    mockUser.bio = patch.bio ?? null;
    mockUser.updatedAt = now();
    return mockUser;
  },

  updateUserAdminByEmail(email: string, isAdmin: boolean) {
    if (mockUser.email.toLowerCase() !== email.toLowerCase()) {
      return null;
    }
    mockUser.isAdmin = isAdmin;
    mockUser.updatedAt = now();
    return mockUser;
  },

  ensureUserProfile(input: {
    userId: string;
    email: string;
    displayName: string;
    avatarUrl?: string | null;
    isAdmin?: boolean;
  }) {
    // mock은 단일 사용자(mockUser)만 표현한다. 승인 사용자 온보딩과 동일하게 pending 멤버십만 반영한다.
    if (input.isAdmin) {
      mockUser.isAdmin = true;
      mockUser.updatedAt = now();
    }
    this.applyPendingRoomMemberships(input.email, input.userId);
    return mockUser;
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

  upsertMembership(input: { userId: string; roomId: string; role: RoomMembership["role"] }) {
    const existing = seedMemberships.find(
      (membership) => membership.userId === input.userId && membership.roomId === input.roomId,
    );
    if (existing) {
      existing.role = input.role;
      return existing;
    }
    const membership: RoomMembership = {
      userId: input.userId,
      roomId: input.roomId,
      role: input.role,
      joinedAt: now(),
    };
    seedMemberships.push(membership);
    return membership;
  },

  deleteMembership(input: { userId: string; roomId: string }) {
    const index = seedMemberships.findIndex(
      (membership) => membership.userId === input.userId && membership.roomId === input.roomId,
    );
    if (index === -1) {
      return { ok: false };
    }
    seedMemberships.splice(index, 1);
    return { ok: true };
  },

  listPendingRoomMemberships(email?: string) {
    return state()
      .pendingMemberships.filter((membership) => !email || membership.email === email.toLowerCase())
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  // 실제 스토어는 audit_logs를 재생해 pending 멤버십을 복원하지만, mock은 직접 저장본을 그대로 반환한다.
  listPendingRoomMembershipsFromAudit(email?: string) {
    return this.listPendingRoomMemberships(email);
  },

  grantAllRoomMemberships(userId: string, role: RoomMembership["role"] = "admin") {
    return this.listRooms().map((room) => this.upsertMembership({ userId, roomId: room.id, role }));
  },

  getIntegrationToken(provider: string): MockIntegrationToken | null {
    return state().integrationTokens.find((token) => token.provider === provider) ?? null;
  },

  upsertIntegrationToken(input: {
    provider: string;
    refreshToken?: string | null;
    accessToken?: string | null;
    expiresAt?: string | null;
    scope?: string | null;
    tokenType?: string | null;
    connectedBy?: string | null;
    metadata?: Record<string, unknown>;
  }): MockIntegrationToken {
    const existing = state().integrationTokens.find((token) => token.provider === input.provider);
    const next: MockIntegrationToken = {
      provider: input.provider,
      refreshToken: input.refreshToken ?? null,
      accessToken: input.accessToken ?? null,
      expiresAt: input.expiresAt ?? null,
      scope: input.scope ?? null,
      tokenType: input.tokenType ?? null,
      connectedBy: input.connectedBy ?? null,
      metadata: input.metadata ?? {},
      createdAt: existing?.createdAt ?? now(),
      updatedAt: now(),
    };
    if (existing) {
      Object.assign(existing, next);
      return existing;
    }
    state().integrationTokens.push(next);
    return next;
  },

  upsertPendingRoomMembership(input: {
    email: string;
    roomId: string;
    role: RoomMembership["role"];
    assignedBy?: string | null;
  }) {
    const email = input.email.toLowerCase();
    const existing = state().pendingMemberships.find(
      (membership) => membership.email === email && membership.roomId === input.roomId,
    );
    if (existing) {
      existing.role = input.role;
      existing.assignedBy = input.assignedBy ?? existing.assignedBy ?? null;
      existing.updatedAt = now();
      return existing;
    }
    const membership: PendingRoomMembership = {
      email,
      roomId: input.roomId,
      role: input.role,
      assignedBy: input.assignedBy ?? null,
      createdAt: now(),
      updatedAt: now(),
    };
    state().pendingMemberships.push(membership);
    return membership;
  },

  deletePendingRoomMembership(input: { email: string; roomId: string }) {
    const email = input.email.toLowerCase();
    const before = state().pendingMemberships.length;
    state().pendingMemberships = state().pendingMemberships.filter(
      (membership) => membership.email !== email || membership.roomId !== input.roomId,
    );
    return { ok: state().pendingMemberships.length < before };
  },

  applyPendingRoomMemberships(email: string, userId: string) {
    const pending = this.listPendingRoomMemberships(email);
    pending.forEach((membership) => {
      this.upsertMembership({ userId, roomId: membership.roomId, role: membership.role });
      this.deletePendingRoomMembership({ email, roomId: membership.roomId });
    });
    return pending;
  },

  listThreads(roomId: string) {
    return state()
      .threads.filter((thread) => thread.roomId === roomId)
      .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  },

  getThread(threadId: string) {
    return state().threads.find((thread) => thread.id === threadId) ?? null;
  },

  ensureRoomThread(roomId: string, input: Partial<RoomThread> = {}) {
    const existing = this.listThreads(roomId).find((thread) => thread.status === "active") ?? this.listThreads(roomId)[0];
    if (existing) {
      return existing;
    }
    return this.createThread({
      roomId,
      title: input.title ?? "기본 대화",
      summary: input.summary ?? "",
      carryoverSummary: input.carryoverSummary ?? "",
      status: input.status ?? "active",
      createdBy: input.createdBy ?? mockUser.userId,
      metadata: input.metadata ?? {},
    });
  },

  createThread(input: Pick<RoomThread, "roomId" | "title"> & Partial<RoomThread>) {
    const thread: RoomThread = {
      id: id(),
      roomId: input.roomId,
      title: input.title,
      summary: input.summary ?? "",
      carryoverSummary: input.carryoverSummary ?? "",
      status: input.status ?? "active",
      lastMessageAt: input.lastMessageAt ?? now(),
      createdBy: input.createdBy ?? mockUser.userId,
      createdAt: now(),
      updatedAt: now(),
      metadata: input.metadata ?? {},
    };
    state().threads.push(thread);
    return thread;
  },

  updateThread(threadId: string, patch: Partial<RoomThread>) {
    const thread = this.getThread(threadId);
    if (!thread) {
      // 실제 스토어(supabaseStore)는 누락 시 throw하고 non-null을 반환하므로 계약을 맞춘다.
      throw new Error("대화를 찾을 수 없습니다.");
    }
    Object.assign(thread, patch, { updatedAt: now() });
    return thread;
  },

  listMessages(roomId: string, threadId?: string | null, options?: { limit?: number }) {
    const list = state()
      .messages.filter((message) => message.roomId === roomId && (!threadId || message.threadId === threadId))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    return options?.limit ? list.slice(-options.limit) : list;
  },

  getMessageById(messageId: string) {
    return state().messages.find((message) => message.id === messageId) ?? null;
  },

  createMessage(input: {
    roomId: string;
    threadId?: string | null;
    type: RoomMessage["type"];
    content: string;
    senderUserId?: string | null;
    senderAgentId?: string | null;
    agentRunId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const thread = (input.threadId ? this.getThread(input.threadId) : null) ?? this.ensureRoomThread(input.roomId);
    const message: RoomMessage = {
      id: id(),
      threadId: thread.id,
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
    this.updateThread(thread.id, { lastMessageAt: message.createdAt });
    return message;
  },

  createAgentRun(input: Partial<AgentRun> & Pick<AgentRun, "roomId" | "mode" | "runType">) {
    const thread = input.threadId ? this.getThread(input.threadId) : this.ensureRoomThread(input.roomId);
    const run: AgentRun = {
      id: id(),
      roomId: input.roomId,
      threadId: thread?.id ?? input.threadId ?? `${input.roomId}-thread-default`,
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
      throw new Error("봇 실행을 찾을 수 없습니다.");
    }
    Object.assign(run, patch);
    return run;
  },

  listAgentRuns() {
    return [...state().agentRuns].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  },

  getAgentRunById(runId: string) {
    return state().agentRuns.find((run) => run.id === runId) ?? null;
  },

  listActiveAgentRunsForRoom(roomId: string) {
    const activeStatuses = new Set(["queued", "running", "requires_action", "idle"]);
    return state().agentRuns.filter((run) => run.roomId === roomId && activeStatuses.has(run.status));
  },

  claimAgentRunForExecution(runId: string) {
    const run = state().agentRuns.find((item) => item.id === runId);
    if (!run || run.status !== "queued") {
      return null;
    }
    run.status = "running";
    return run;
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

  listRoomMemoryStores(roomId: string) {
    return state().memoryStores.filter((store) => store.roomId === roomId);
  },

  updateMemory(roomId: string, patch: Partial<DomainMemory>) {
    const memory = this.getMemory(roomId);
    if (!memory) {
      throw new Error("방 메모리를 찾을 수 없습니다.");
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
    const removed = new Set(
      state()
        .removedFileAccess.filter((access) => access.roomId === roomId)
        .map((access) => access.fileId),
    );
    const sharedAccess = new Map(
      state()
        .sharedFileAccess.filter((access) => access.roomId === roomId)
        .map((access) => [access.fileId, access.accessLevel]),
    );
    return state()
      .files.filter((file) => file.storagePath.startsWith(`${roomId}/`) || roomId === "meeting" || sharedAccess.has(file.id))
      .filter((file) => !removed.has(file.id))
      .map((file) => ({
        ...file,
        accessLevel: sharedAccess.get(file.id) ?? file.accessLevel,
      }));
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

  createFileVersion(input: {
    fileId: string;
    storagePath: string;
    createdBy?: string | null;
    changeSummary: string;
    agentRunId?: string | null;
  }) {
    const file = state().files.find((item) => item.id === input.fileId);
    if (!file) {
      throw new Error("파일을 찾을 수 없습니다.");
    }
    file.versionNo = (file.versionNo ?? 1) + 1;
    return { ...file, accessLevel: "write" as const };
  },

  removeFileFromRoom(roomId: string, fileId: string) {
    state().removedFileAccess.push({ roomId, fileId });
    state().sharedFileAccess = state().sharedFileAccess.filter(
      (access) => access.roomId !== roomId || access.fileId !== fileId,
    );
    const hasOtherAccess = seedRooms
      .filter((room) => room.id !== roomId)
      .some((room) => this.listFiles(room.id).some((file) => file.id === fileId));
    if (!hasOtherAccess) {
      state().files = state().files.filter((file) => file.id !== fileId);
    }
    return { ok: true };
  },

  grantFileAccess(roomId: string, fileId: string, accessLevel: FileRecord["accessLevel"] = "read") {
    state().removedFileAccess = state().removedFileAccess.filter(
      (access) => access.roomId !== roomId || access.fileId !== fileId,
    );
    const existing = state().sharedFileAccess.find((access) => access.roomId === roomId && access.fileId === fileId);
    if (existing) {
      existing.accessLevel = accessLevel;
      return existing;
    }
    const access = { roomId, fileId, accessLevel };
    state().sharedFileAccess.push(access);
    return access;
  },

  listSharedItems(roomId?: string) {
    return state().sharedItems.filter(
      (item) => !item.metadata.deletedAt && (!roomId || item.targetRoomId === roomId || item.sourceRoomId === roomId),
    );
  },

  createSharedItem(input: Partial<SharedItem> & Pick<SharedItem, "sourceRoomId" | "title" | "summary">) {
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

  deleteSharedItem(sharedItemId: string, deletedBy?: string | null) {
    const item = state().sharedItems.find((sharedItem) => sharedItem.id === sharedItemId);
    if (!item) {
      return null;
    }
    item.metadata = {
      ...item.metadata,
      deletedAt: now(),
      deletedBy: deletedBy ?? null,
    };
    return item;
  },

  listImports(roomId?: string) {
    return state().imports.filter(
      (item) => item.status !== "dismissed" && (!roomId || item.targetRoomId === roomId || item.meetingRoomId === roomId),
    );
  },

  createImport(input: Partial<MeetingImport> & Pick<MeetingImport, "targetRoomId">) {
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

  updateImport(importId: string, patch: Partial<MeetingImport>) {
    const item = state().imports.find((meetingImport) => meetingImport.id === importId);
    if (!item) {
      throw new Error("반입 항목을 찾을 수 없습니다.");
    }
    Object.assign(item, patch, {
      metadata: {
        ...item.metadata,
        ...(patch.metadata ?? {}),
      },
    });
    return item;
  },

  listDecisions(roomId?: string) {
    return state().decisions.filter((decision) => !roomId || decision.roomId === roomId);
  },

  createDecision(input: Partial<Decision> & Pick<Decision, "roomId" | "title">) {
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

  updateDecision(decisionId: string, patch: Partial<Decision>) {
    const decision = state().decisions.find((item) => item.id === decisionId);
    if (!decision) {
      throw new Error("결정 항목을 찾을 수 없습니다.");
    }
    Object.assign(decision, patch);
    return decision;
  },

  deleteDecision(decisionId: string) {
    const before = state().decisions.length;
    state().decisions = state().decisions.filter((decision) => decision.id !== decisionId);
    return state().decisions.length < before;
  },

  listTasks(roomId?: string) {
    return state().tasks.filter((task) => !roomId || isTaskVisibleInRoom(task, roomId));
  },

  createTask(input: Partial<Task> & Pick<Task, "roomId" | "title">) {
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
      metadata: input.metadata ?? {},
    };
    state().tasks.push(task);
    return task;
  },

  addAuditLog(input: Partial<AuditLog> & Pick<AuditLog, "action">) {
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

  addMemoryReview(input: Partial<MemoryWriteReview> & Pick<MemoryWriteReview, "roomId" | "proposedMemory">) {
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

  createVideoMeeting(input: Partial<VideoMeeting> & Pick<VideoMeeting, "roomId" | "provider" | "title">) {
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
      throw new Error("회의를 찾을 수 없습니다.");
    }
    Object.assign(meeting, patch, { updatedAt: now() });
    return meeting;
  },

  addVideoArtifact(input: Partial<VideoMeetingArtifact> & Pick<VideoMeetingArtifact, "videoMeetingId" | "artifactType" | "title">) {
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

  addVideoEvent(input: Partial<VideoMeetingEvent> & Pick<VideoMeetingEvent, "videoMeetingId" | "roomId" | "eventType">) {
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

  listRoomBriefings(roomId?: string, limit = 20) {
    return state()
      .roomBriefings.filter((briefing) => !roomId || briefing.roomId === roomId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  },

  createRoomBriefing(input: Partial<RoomBriefing> & Pick<RoomBriefing, "roomId" | "periodStart" | "periodEnd" | "summary">) {
    const briefing: RoomBriefing = {
      id: id(),
      roomId: input.roomId,
      agentId: input.agentId ?? null,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      summary: input.summary,
      risks: input.risks ?? [],
      nextActions: input.nextActions ?? [],
      blockedItems: input.blockedItems ?? [],
      sourceCounts: input.sourceCounts ?? {},
      status: input.status ?? "ready",
      createdBy: input.createdBy ?? mockUser.userId,
      createdAt: now(),
      metadata: input.metadata ?? {},
    };
    state().roomBriefings.push(briefing);
    return briefing;
  },

  listCoordinatorBriefings(limit = 10) {
    return [...state().coordinatorBriefings]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  },

  createCoordinatorBriefing(
    input: Partial<CoordinatorBriefing> & Pick<CoordinatorBriefing, "periodStart" | "periodEnd" | "summary">,
  ) {
    const briefing: CoordinatorBriefing = {
      id: id(),
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      summary: input.summary,
      roomHighlights: input.roomHighlights ?? [],
      crossRoomRisks: input.crossRoomRisks ?? [],
      decisionsNeeded: input.decisionsNeeded ?? [],
      nextActions: input.nextActions ?? [],
      sourceRoomBriefingIds: input.sourceRoomBriefingIds ?? [],
      createdBy: input.createdBy ?? mockUser.userId,
      createdAt: now(),
      metadata: input.metadata ?? {},
    };
    state().coordinatorBriefings.push(briefing);
    return briefing;
  },
};
