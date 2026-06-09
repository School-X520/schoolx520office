import "server-only";

import { COORDINATOR_AGENT_ID, getCoordinatorAgent } from "@/lib/agents/development-agent";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
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
  Room,
  RoomMemoryStore,
  RoomMembership,
  RoomMessage,
  RoomThread,
  SharedItem,
  Task,
  UserProfile,
  VideoMeeting,
  VideoMeetingArtifact,
  VideoMeetingEvent,
} from "@/types/domain";

type DbError = { message: string };
type DbResult = { data: unknown; error: DbError | null };
type DbQuery = PromiseLike<DbResult> & {
  select: (columns?: string) => DbQuery;
  insert: (value: Record<string, unknown> | Record<string, unknown>[]) => DbQuery;
  upsert: (value: Record<string, unknown> | Record<string, unknown>[]) => DbQuery;
  update: (value: Record<string, unknown>) => DbQuery;
  delete: () => DbQuery;
  eq: (column: string, value: unknown) => DbQuery;
  in: (column: string, values: unknown[]) => DbQuery;
  or: (filters: string) => DbQuery;
  order: (column: string, options?: { ascending?: boolean; foreignTable?: string }) => DbQuery;
  limit: (count: number) => DbQuery;
  maybeSingle: () => PromiseLike<DbResult>;
  single: () => PromiseLike<DbResult>;
};
type LooseDb = { from: (table: string) => DbQuery };
type CreateSharedItemInput = Pick<SharedItem, "sourceRoomId" | "title" | "summary"> &
  Partial<Omit<SharedItem, "id" | "createdAt">>;
type CreateRoomThreadInput = Pick<RoomThread, "roomId" | "title"> &
  Partial<Omit<RoomThread, "id" | "roomId" | "title" | "createdAt" | "updatedAt">>;
type CreateImportInput = Pick<MeetingImport, "targetRoomId"> & Partial<Omit<MeetingImport, "id" | "createdAt">>;
type CreateDecisionInput = Pick<Decision, "roomId" | "title"> & Partial<Omit<Decision, "id" | "createdAt">>;
type CreateTaskInput = Pick<Task, "roomId" | "title"> &
  Partial<Omit<Task, "id" | "roomId" | "title" | "createdAt" | "updatedAt">>;
type CreateAuditInput = Pick<AuditLog, "action"> & Partial<Omit<AuditLog, "id" | "createdAt">>;
type CreateMemoryReviewInput = Pick<MemoryWriteReview, "roomId" | "proposedMemory"> &
  Partial<Omit<MemoryWriteReview, "id" | "createdAt">>;
type CreatePendingMembershipInput = Pick<PendingRoomMembership, "email" | "roomId" | "role"> &
  Partial<Omit<PendingRoomMembership, "email" | "roomId" | "role" | "createdAt" | "updatedAt">>;
type CreateAgentPersonaVersionInput = Pick<AgentPersonaVersion, "agentId" | "roomId" | "persona" | "versionNo"> &
  Partial<Omit<AgentPersonaVersion, "id" | "createdAt">>;
type CreateVideoMeetingInput = Pick<VideoMeeting, "roomId" | "provider" | "title"> &
  Partial<Omit<VideoMeeting, "id" | "createdAt" | "updatedAt">>;
type CreateVideoArtifactInput = Pick<VideoMeetingArtifact, "videoMeetingId" | "artifactType" | "title"> &
  Partial<Omit<VideoMeetingArtifact, "id" | "createdAt">>;
type CreateVideoEventInput = Pick<VideoMeetingEvent, "videoMeetingId" | "roomId" | "eventType"> &
  Partial<Omit<VideoMeetingEvent, "id" | "createdAt">>;
type CreateRoomBriefingInput = Pick<RoomBriefing, "roomId" | "periodStart" | "periodEnd" | "summary"> &
  Partial<Omit<RoomBriefing, "id" | "roomId" | "periodStart" | "periodEnd" | "summary" | "createdAt">>;
type CreateCoordinatorBriefingInput = Pick<CoordinatorBriefing, "periodStart" | "periodEnd" | "summary"> &
  Partial<Omit<CoordinatorBriefing, "id" | "periodStart" | "periodEnd" | "summary" | "createdAt">>;

function db() {
  const client = getSupabaseAdminClient();
  if (!client) {
    throw new Error("Supabase service role is not configured.");
  }
  return client as unknown as LooseDb;
}

function assertOk<T>(data: unknown, error: DbError | null): T {
  if (error) {
    throw new Error(error.message);
  }
  return data as T;
}

function isThreadSchemaMissing(error: DbError | null) {
  if (!error?.message) {
    return false;
  }
  return (
    error.message.includes("room_threads") ||
    error.message.includes("thread_id") ||
    error.message.includes("schema cache")
  );
}

function isAgentPersonaSchemaMissing(error: DbError | null) {
  if (!error?.message) {
    return false;
  }
  return (
    error.message.includes("persona_draft") ||
    error.message.includes("persona_published") ||
    error.message.includes("agent_persona_versions") ||
    error.message.includes("schema cache")
  );
}

function isCoordinatorBriefingSchemaMissing(error: DbError | null) {
  if (!error?.message) {
    return false;
  }
  return (
    error.message.includes("room_briefings") ||
    error.message.includes("coordinator_briefings") ||
    error.message.includes("schema cache")
  );
}

function isPendingMembershipSchemaMissing(error: DbError | null) {
  if (!error?.message) {
    return false;
  }
  return error.message.includes("pending_room_memberships") || error.message.includes("schema cache");
}

function rows(data: unknown) {
  return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
}

function row(data: unknown) {
  return data && typeof data === "object" ? (data as Record<string, unknown>) : null;
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullableText(value: unknown) {
  return typeof value === "string" ? value : null;
}

function bool(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" ? value : fallback;
}

function jsonObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function jsonArray(value: unknown) {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

function legacyThread(roomId: string): RoomThread {
  const now = new Date().toISOString();
  return {
    id: `${roomId}-legacy-thread`,
    roomId,
    title: "기본 대화",
    summary: "",
    carryoverSummary: "",
    status: "active",
    lastMessageAt: now,
    createdBy: null,
    createdAt: now,
    updatedAt: now,
    metadata: { schemaFallback: true },
  };
}

function defaultAgentPersona(input: { role: string; systemPrompt: string; guestPrompt: string; name: string }): AgentPersona {
  const role = input.systemPrompt || input.role || `${input.name}로 담당 업무를 지원한다.`;
  return {
    role,
    tone: "신중하고 간결한 한국어로 답한다.",
    outputStyle: "먼저 결론을 짧게 말하고, 필요한 다음 행동을 bullet로 정리한다.",
    priorities: `${input.role || input.name}의 업무 목표, 일정, 산출물 품질을 우선한다.`,
    boundaries: "학생 개인정보, 계정, API 키, 내부 민감정보를 출력하지 않는다.",
    customInstructions: "",
    guestPrompt: input.guestPrompt || "회의방에서는 5문장 이내로 출처와 다음 행동을 포함해 브리핑한다.",
  };
}

function agentPersonaFrom(value: unknown, fallback: AgentPersona): AgentPersona {
  const source = jsonObject(value);
  return {
    role: text(source.role, fallback.role),
    tone: text(source.tone, fallback.tone),
    outputStyle: text(source.outputStyle, fallback.outputStyle),
    priorities: text(source.priorities, fallback.priorities),
    boundaries: text(source.boundaries, fallback.boundaries),
    customInstructions: text(source.customInstructions, fallback.customInstructions),
    guestPrompt: text(source.guestPrompt, fallback.guestPrompt),
  };
}

function roomFrom(rowValue: Record<string, unknown>): Room {
  return {
    id: text(rowValue.id),
    name: text(rowValue.name),
    type: text(rowValue.type) as Room["type"],
    icon: text(rowValue.icon),
    description: text(rowValue.description),
    defaultModel: nullableText(rowValue.default_model) ?? undefined,
    displayOrder: numberValue(rowValue.display_order),
    layoutX: numberValue(rowValue.layout_x),
    layoutY: numberValue(rowValue.layout_y),
    isActive: bool(rowValue.is_active, true),
    createdAt: text(rowValue.created_at),
  };
}

function membershipFrom(rowValue: Record<string, unknown>): RoomMembership {
  return {
    userId: text(rowValue.user_id),
    roomId: text(rowValue.room_id),
    role: text(rowValue.role, "member") as RoomMembership["role"],
    joinedAt: text(rowValue.joined_at),
  };
}

function allowedUserFrom(rowValue: Record<string, unknown>): AllowedUser {
  return {
    email: text(rowValue.email),
    invitedBy: nullableText(rowValue.invited_by),
    invitedAt: text(rowValue.invited_at),
    notes: nullableText(rowValue.notes),
    isActive: bool(rowValue.is_active, true),
    isAdmin: bool(rowValue.is_admin),
  };
}

function userProfileFrom(rowValue: Record<string, unknown>): UserProfile {
  return {
    userId: text(rowValue.user_id),
    email: text(rowValue.email),
    displayName: text(rowValue.display_name, text(rowValue.email)),
    avatarUrl: nullableText(rowValue.avatar_url),
    bio: nullableText(rowValue.bio),
    isAdmin: bool(rowValue.is_admin),
    createdAt: text(rowValue.created_at),
    updatedAt: text(rowValue.updated_at),
  };
}

function agentFrom(rowValue: Record<string, unknown>): Agent {
  const metadata = jsonObject(rowValue.metadata);
  const base = {
    name: text(rowValue.name),
    role: text(rowValue.role),
    systemPrompt: text(rowValue.system_prompt),
    guestPrompt: text(rowValue.guest_prompt),
  };
  const fallbackPersona = defaultAgentPersona(base);
  return {
    id: text(rowValue.id),
    roomId: text(rowValue.room_id),
    name: base.name,
    role: base.role,
    anthropicAgentId: nullableText(rowValue.anthropic_agent_id),
    anthropicEnvironmentId: nullableText(rowValue.anthropic_environment_id),
    defaultModel: text(rowValue.default_model, "claude-sonnet-4-5"),
    systemPrompt: base.systemPrompt,
    guestPrompt: base.guestPrompt,
    personaDraft: agentPersonaFrom(rowValue.persona_draft ?? metadata.persona_draft, fallbackPersona),
    personaPublished: agentPersonaFrom(rowValue.persona_published ?? metadata.persona_published, fallbackPersona),
    personaDraftUpdatedBy: nullableText(rowValue.persona_draft_updated_by) ?? nullableText(metadata.persona_draft_updated_by),
    personaDraftUpdatedAt: nullableText(rowValue.persona_draft_updated_at) ?? nullableText(metadata.persona_draft_updated_at),
    personaPublishedBy: nullableText(rowValue.persona_published_by) ?? nullableText(metadata.persona_published_by),
    personaPublishedAt: nullableText(rowValue.persona_published_at) ?? nullableText(metadata.persona_published_at),
    isActive: bool(rowValue.is_active, true),
    metadata,
    createdAt: text(rowValue.created_at),
    updatedAt: text(rowValue.updated_at),
  };
}

function threadFrom(rowValue: Record<string, unknown>): RoomThread {
  return {
    id: text(rowValue.id),
    roomId: text(rowValue.room_id),
    title: text(rowValue.title, "새 대화"),
    summary: text(rowValue.summary),
    carryoverSummary: text(rowValue.carryover_summary),
    status: text(rowValue.status, "active") as RoomThread["status"],
    lastMessageAt: text(rowValue.last_message_at, text(rowValue.created_at)),
    createdBy: nullableText(rowValue.created_by),
    createdAt: text(rowValue.created_at),
    updatedAt: text(rowValue.updated_at),
    metadata: jsonObject(rowValue.metadata),
  };
}

function messageFrom(rowValue: Record<string, unknown>): RoomMessage {
  const roomId = text(rowValue.room_id);
  return {
    id: text(rowValue.id),
    roomId,
    threadId: text(rowValue.thread_id, `${roomId}-legacy-thread`),
    senderUserId: nullableText(rowValue.sender_user_id),
    senderAgentId: nullableText(rowValue.sender_agent_id),
    agentRunId: nullableText(rowValue.agent_run_id),
    type: text(rowValue.type, "system") as RoomMessage["type"],
    content: text(rowValue.content),
    metadata: jsonObject(rowValue.metadata),
    createdAt: text(rowValue.created_at),
  };
}

function memoryFrom(rowValue: Record<string, unknown>): DomainMemory {
  return {
    roomId: text(rowValue.room_id),
    summary: text(rowValue.summary),
    activeTasks: jsonArray(rowValue.active_tasks),
    decisions: jsonArray(rowValue.decisions),
    keyFacts: jsonArray(rowValue.key_facts),
    pendingContext: jsonArray(rowValue.pending_context),
    processedContext: jsonArray(rowValue.processed_context),
    metadata: jsonObject(rowValue.metadata),
    updatedAt: text(rowValue.updated_at),
    updatedByAgentRun: nullableText(rowValue.updated_by_agent_run),
  };
}

function roomMemoryStoreFrom(rowValue: Record<string, unknown>): RoomMemoryStore {
  return {
    id: text(rowValue.id),
    roomId: text(rowValue.room_id),
    anthropicMemoryStoreId: nullableText(rowValue.anthropic_memory_store_id),
    accessMode: text(rowValue.access_mode, "read_write") as RoomMemoryStore["accessMode"],
    purpose: text(rowValue.purpose),
    createdAt: text(rowValue.created_at),
    updatedAt: text(rowValue.updated_at),
  };
}

function agentRunFrom(rowValue: Record<string, unknown>): AgentRun {
  const roomId = text(rowValue.room_id);
  return {
    id: text(rowValue.id),
    roomId,
    threadId: text(rowValue.thread_id, `${roomId}-legacy-thread`),
    agentId: nullableText(rowValue.agent_id),
    initiatedBy: nullableText(rowValue.initiated_by),
    anthropicSessionId: nullableText(rowValue.anthropic_session_id),
    mode: text(rowValue.mode, "room") as AgentRun["mode"],
    runType: text(rowValue.run_type, "room_agent") as AgentRun["runType"],
    guestSourceRoomId: nullableText(rowValue.guest_source_room_id),
    status: text(rowValue.status, "queued") as AgentRun["status"],
    inputMessageId: nullableText(rowValue.input_message_id),
    outputMessageId: nullableText(rowValue.output_message_id),
    sessionSummary: nullableText(rowValue.session_summary),
    tokenUsage: jsonObject(rowValue.token_usage),
    error: nullableText(rowValue.error),
    startedAt: text(rowValue.started_at),
    endedAt: nullableText(rowValue.ended_at),
    metadata: jsonObject(rowValue.metadata),
  };
}

function agentRunEventFrom(rowValue: Record<string, unknown>): AgentRunEvent {
  return {
    id: text(rowValue.id),
    agentRunId: text(rowValue.agent_run_id),
    anthropicEventId: nullableText(rowValue.anthropic_event_id),
    eventType: text(rowValue.event_type),
    payload: jsonObject(rowValue.payload),
    createdAt: text(rowValue.created_at),
  };
}

function sharedItemFrom(rowValue: Record<string, unknown>): SharedItem {
  const metadata = jsonObject(rowValue.metadata);
  return {
    id: text(rowValue.id),
    sourceRoomId: text(rowValue.source_room_id),
    sourceRoomName: nullableText(metadata.sourceRoomName),
    targetRoomId: text(rowValue.target_room_id, "meeting"),
    targetRoomName: nullableText(metadata.targetRoomName),
    sourceMessageId: nullableText(rowValue.source_message_id),
    sourceFileId: nullableText(rowValue.source_file_id),
    title: text(rowValue.title),
    summary: text(rowValue.summary),
    sharedBy: nullableText(rowValue.shared_by),
    createdAt: text(rowValue.created_at),
    metadata,
  };
}

function importFrom(rowValue: Record<string, unknown>): MeetingImport {
  return {
    id: text(rowValue.id),
    meetingRoomId: text(rowValue.meeting_room_id, "meeting"),
    targetRoomId: text(rowValue.target_room_id),
    sharedItemId: nullableText(rowValue.shared_item_id),
    sourceMessageId: nullableText(rowValue.source_message_id),
    sourceFileId: nullableText(rowValue.source_file_id),
    importedBy: nullableText(rowValue.imported_by),
    status: text(rowValue.status, "pending") as MeetingImport["status"],
    createdAt: text(rowValue.created_at),
    metadata: jsonObject(rowValue.metadata),
  };
}

function fileFrom(rowValue: Record<string, unknown>): FileRecord {
  return {
    id: text(rowValue.id),
    storagePath: text(rowValue.storage_path),
    originalName: text(rowValue.original_name),
    uploadedBy: nullableText(rowValue.uploaded_by),
    sizeBytes: numberValue(rowValue.size_bytes),
    mimeType: text(rowValue.mime_type, "application/octet-stream"),
    checksum: nullableText(rowValue.checksum),
    createdAt: text(rowValue.created_at),
    versionNo: numberValue(rowValue.version_no, 1),
    accessLevel: text(rowValue.access_level, "read") as FileRecord["accessLevel"],
  };
}

function decisionFrom(rowValue: Record<string, unknown>): Decision {
  return {
    id: text(rowValue.id),
    roomId: text(rowValue.room_id),
    sourceMessageId: nullableText(rowValue.source_message_id),
    title: text(rowValue.title),
    description: nullableText(rowValue.description),
    decidedBy: nullableText(rowValue.decided_by),
    createdAt: text(rowValue.created_at),
  };
}

function taskFrom(rowValue: Record<string, unknown>): Task {
  return {
    id: text(rowValue.id),
    roomId: text(rowValue.room_id),
    decisionId: nullableText(rowValue.decision_id),
    title: text(rowValue.title),
    description: nullableText(rowValue.description),
    assigneeUserId: nullableText(rowValue.assignee_user_id),
    assigneeRoomId: nullableText(rowValue.assignee_room_id),
    status: text(rowValue.status, "todo") as Task["status"],
    dueAt: nullableText(rowValue.due_at),
    createdBy: nullableText(rowValue.created_by),
    createdAt: text(rowValue.created_at),
    updatedAt: text(rowValue.updated_at),
    metadata: jsonObject(rowValue.metadata),
  };
}

function isTaskVisibleInRoom(task: Task, roomId: string) {
  return task.roomId === roomId || task.assigneeRoomId === roomId;
}

function auditFrom(rowValue: Record<string, unknown>): AuditLog {
  return {
    id: text(rowValue.id),
    actorUserId: nullableText(rowValue.actor_user_id),
    actorAgentId: nullableText(rowValue.actor_agent_id),
    roomId: nullableText(rowValue.room_id),
    action: text(rowValue.action),
    targetType: nullableText(rowValue.target_type),
    targetId: nullableText(rowValue.target_id),
    metadata: jsonObject(rowValue.metadata),
    createdAt: text(rowValue.created_at),
  };
}

function memoryReviewFrom(rowValue: Record<string, unknown>): MemoryWriteReview {
  return {
    id: text(rowValue.id),
    roomId: text(rowValue.room_id),
    agentRunId: nullableText(rowValue.agent_run_id),
    proposedMemory: jsonObject(rowValue.proposed_memory),
    status: text(rowValue.status, "pending") as MemoryWriteReview["status"],
    reviewedBy: nullableText(rowValue.reviewed_by),
    reviewedAt: nullableText(rowValue.reviewed_at),
    createdAt: text(rowValue.created_at),
  };
}

function pendingMembershipFrom(rowValue: Record<string, unknown>): PendingRoomMembership {
  return {
    email: text(rowValue.email).toLowerCase(),
    roomId: text(rowValue.room_id),
    role: text(rowValue.role, "member") as PendingRoomMembership["role"],
    assignedBy: nullableText(rowValue.assigned_by),
    createdAt: text(rowValue.created_at),
    updatedAt: text(rowValue.updated_at, text(rowValue.created_at)),
  };
}

function pendingMembershipFromJson(value: unknown): PendingRoomMembership | null {
  const source = jsonObject(value);
  const email = text(source.email).toLowerCase();
  const roomId = text(source.roomId);
  if (!email || !roomId) {
    return null;
  }
  return {
    email,
    roomId,
    role: text(source.role, "member") as PendingRoomMembership["role"],
    assignedBy: nullableText(source.assignedBy),
    createdAt: text(source.createdAt, new Date().toISOString()),
    updatedAt: text(source.updatedAt, new Date().toISOString()),
  };
}

function agentPersonaVersionFrom(rowValue: Record<string, unknown>): AgentPersonaVersion {
  const persona = agentPersonaFrom(rowValue.persona, defaultAgentPersona({
    name: "업무 봇",
    role: "업무방 도메인 봇",
    systemPrompt: "",
    guestPrompt: "",
  }));
  return {
    id: text(rowValue.id),
    agentId: text(rowValue.agent_id),
    roomId: text(rowValue.room_id),
    versionNo: numberValue(rowValue.version_no, 1),
    persona,
    anthropicAgentId: nullableText(rowValue.anthropic_agent_id),
    anthropicAgentVersion: typeof rowValue.anthropic_agent_version === "number" ? rowValue.anthropic_agent_version : null,
    publishedBy: nullableText(rowValue.published_by),
    createdAt: text(rowValue.created_at),
    metadata: jsonObject(rowValue.metadata),
  };
}

function videoMeetingFrom(rowValue: Record<string, unknown>): VideoMeeting {
  return {
    id: text(rowValue.id),
    roomId: text(rowValue.room_id),
    provider: text(rowValue.provider, "google_meet") as VideoMeeting["provider"],
    title: text(rowValue.title),
    description: nullableText(rowValue.description),
    status: text(rowValue.status, "scheduled") as VideoMeeting["status"],
    providerSpaceName: nullableText(rowValue.provider_space_name),
    providerConferenceName: nullableText(rowValue.provider_conference_name),
    providerMeetingId: nullableText(rowValue.provider_meeting_id),
    providerMeetingCode: nullableText(rowValue.provider_meeting_code),
    joinUrl: nullableText(rowValue.join_url),
    hostUrl: nullableText(rowValue.host_url),
    embedAllowed: bool(rowValue.embed_allowed),
    scheduledStartAt: nullableText(rowValue.scheduled_start_at),
    startedAt: nullableText(rowValue.started_at),
    endedAt: nullableText(rowValue.ended_at),
    createdBy: nullableText(rowValue.created_by),
    endedBy: nullableText(rowValue.ended_by),
    consentRecording: bool(rowValue.consent_recording),
    consentTranscript: bool(rowValue.consent_transcript),
    consentAiSummary: bool(rowValue.consent_ai_summary, true),
    metadata: jsonObject(rowValue.metadata),
    createdAt: text(rowValue.created_at),
    updatedAt: text(rowValue.updated_at),
  };
}

function videoArtifactFrom(rowValue: Record<string, unknown>): VideoMeetingArtifact {
  return {
    id: text(rowValue.id),
    videoMeetingId: text(rowValue.video_meeting_id),
    artifactType: text(rowValue.artifact_type, "manual_minutes") as VideoMeetingArtifact["artifactType"],
    title: text(rowValue.title),
    content: nullableText(rowValue.content),
    externalUrl: nullableText(rowValue.external_url),
    fileId: nullableText(rowValue.file_id),
    providerArtifactName: nullableText(rowValue.provider_artifact_name),
    status: text(rowValue.status, "available") as VideoMeetingArtifact["status"],
    createdBy: nullableText(rowValue.created_by),
    metadata: jsonObject(rowValue.metadata),
    createdAt: text(rowValue.created_at),
  };
}

function videoEventFrom(rowValue: Record<string, unknown>): VideoMeetingEvent {
  return {
    id: text(rowValue.id),
    videoMeetingId: text(rowValue.video_meeting_id),
    roomId: text(rowValue.room_id),
    eventType: text(rowValue.event_type),
    actorUserId: nullableText(rowValue.actor_user_id),
    payload: jsonObject(rowValue.payload),
    createdAt: text(rowValue.created_at),
  };
}

function roomBriefingFrom(rowValue: Record<string, unknown>): RoomBriefing {
  return {
    id: text(rowValue.id),
    roomId: text(rowValue.room_id),
    agentId: nullableText(rowValue.agent_id),
    periodStart: text(rowValue.period_start),
    periodEnd: text(rowValue.period_end),
    summary: text(rowValue.summary),
    risks: jsonArray(rowValue.risks),
    nextActions: jsonArray(rowValue.next_actions),
    blockedItems: jsonArray(rowValue.blocked_items),
    sourceCounts: jsonObject(rowValue.source_counts),
    status: text(rowValue.status, "ready") as RoomBriefing["status"],
    createdBy: nullableText(rowValue.created_by),
    createdAt: text(rowValue.created_at),
    metadata: jsonObject(rowValue.metadata),
  };
}

function coordinatorBriefingFrom(rowValue: Record<string, unknown>): CoordinatorBriefing {
  return {
    id: text(rowValue.id),
    periodStart: text(rowValue.period_start),
    periodEnd: text(rowValue.period_end),
    summary: text(rowValue.summary),
    roomHighlights: jsonArray(rowValue.room_highlights),
    crossRoomRisks: jsonArray(rowValue.cross_room_risks),
    decisionsNeeded: jsonArray(rowValue.decisions_needed),
    nextActions: jsonArray(rowValue.next_actions),
    sourceRoomBriefingIds: Array.isArray(rowValue.source_room_briefing_ids)
      ? rowValue.source_room_briefing_ids.map(String)
      : [],
    createdBy: nullableText(rowValue.created_by),
    createdAt: text(rowValue.created_at),
    metadata: jsonObject(rowValue.metadata),
  };
}

function fallbackRoomBriefing(input: CreateRoomBriefingInput): RoomBriefing {
  return {
    id: crypto.randomUUID(),
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
    createdBy: input.createdBy ?? null,
    createdAt: new Date().toISOString(),
    metadata: { ...(input.metadata ?? {}), fallbackStore: "audit_logs" },
  };
}

function fallbackCoordinatorBriefing(input: CreateCoordinatorBriefingInput): CoordinatorBriefing {
  return {
    id: crypto.randomUUID(),
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    summary: input.summary,
    roomHighlights: input.roomHighlights ?? [],
    crossRoomRisks: input.crossRoomRisks ?? [],
    decisionsNeeded: input.decisionsNeeded ?? [],
    nextActions: input.nextActions ?? [],
    sourceRoomBriefingIds: input.sourceRoomBriefingIds ?? [],
    createdBy: input.createdBy ?? null,
    createdAt: new Date().toISOString(),
    metadata: { ...(input.metadata ?? {}), fallbackStore: "audit_logs" },
  };
}

function roomBriefingFromJson(value: unknown): RoomBriefing | null {
  const source = jsonObject(value);
  const roomId = text(source.roomId);
  const summary = text(source.summary);
  if (!roomId || !summary) {
    return null;
  }
  return {
    id: text(source.id, crypto.randomUUID()),
    roomId,
    agentId: nullableText(source.agentId),
    periodStart: text(source.periodStart),
    periodEnd: text(source.periodEnd),
    summary,
    risks: jsonArray(source.risks),
    nextActions: jsonArray(source.nextActions),
    blockedItems: jsonArray(source.blockedItems),
    sourceCounts: jsonObject(source.sourceCounts),
    status: text(source.status, "ready") as RoomBriefing["status"],
    createdBy: nullableText(source.createdBy),
    createdAt: text(source.createdAt, new Date().toISOString()),
    metadata: jsonObject(source.metadata),
  };
}

function coordinatorBriefingFromJson(value: unknown): CoordinatorBriefing | null {
  const source = jsonObject(value);
  const summary = text(source.summary);
  if (!summary) {
    return null;
  }
  return {
    id: text(source.id, crypto.randomUUID()),
    periodStart: text(source.periodStart),
    periodEnd: text(source.periodEnd),
    summary,
    roomHighlights: jsonArray(source.roomHighlights),
    crossRoomRisks: jsonArray(source.crossRoomRisks),
    decisionsNeeded: jsonArray(source.decisionsNeeded),
    nextActions: jsonArray(source.nextActions),
    sourceRoomBriefingIds: Array.isArray(source.sourceRoomBriefingIds)
      ? source.sourceRoomBriefingIds.map(String)
      : [],
    createdBy: nullableText(source.createdBy),
    createdAt: text(source.createdAt, new Date().toISOString()),
    metadata: jsonObject(source.metadata),
  };
}

export const supabaseStore = {
  async listRooms() {
    const { data, error } = await db()
      .from("rooms")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });
    return rows(assertOk(data, error)).map(roomFrom);
  },

  async getRoom(roomId: string) {
    const { data, error } = await db().from("rooms").select("*").eq("id", roomId).maybeSingle();
    const result = row(assertOk(data, error));
    return result ? roomFrom(result) : null;
  },

  async listAgents() {
    const { data, error } = await db().from("agents").select("*").eq("is_active", true);
    return rows(assertOk(data, error)).map(agentFrom);
  },

  async listAllowedUsers() {
    const { data, error } = await db()
      .from("allowed_users")
      .select("*")
      .order("invited_at", { ascending: false });
    return rows(assertOk(data, error)).map(allowedUserFrom);
  },

  async getAllowedUser(email: string) {
    const { data, error } = await db()
      .from("allowed_users")
      .select("*")
      .eq("email", email.toLowerCase())
      .maybeSingle();
    const result = row(assertOk(data, error));
    return result ? allowedUserFrom(result) : null;
  },

  async listUserProfiles() {
    const { data, error } = await db()
      .from("user_profiles")
      .select("*")
      .order("created_at", { ascending: false });
    return rows(assertOk(data, error)).map(userProfileFrom);
  },

  async getUserProfileByEmail(email: string) {
    const { data, error } = await db()
      .from("user_profiles")
      .select("*")
      .eq("email", email.toLowerCase())
      .maybeSingle();
    const result = row(assertOk(data, error));
    return result ? userProfileFrom(result) : null;
  },

  async updateUserAdminByEmail(email: string, isAdmin: boolean) {
    const { data, error } = await db()
      .from("user_profiles")
      .update({ is_admin: isAdmin })
      .eq("email", email.toLowerCase())
      .select("*")
      .maybeSingle();
    const result = row(assertOk(data, error));
    return result ? userProfileFrom(result) : null;
  },

  async updateAllowedUser(
    email: string,
    patch: {
      isActive?: boolean;
      isAdmin?: boolean;
      notes?: string | null;
    },
  ) {
    const updates: Record<string, unknown> = {};
    if (typeof patch.isActive === "boolean") {
      updates.is_active = patch.isActive;
    }
    if (typeof patch.isAdmin === "boolean") {
      updates.is_admin = patch.isAdmin;
    }
    if ("notes" in patch) {
      updates.notes = patch.notes ?? null;
    }
    if (!Object.keys(updates).length) {
      return this.getAllowedUser(email);
    }
    const { data, error } = await db()
      .from("allowed_users")
      .update(updates)
      .eq("email", email.toLowerCase())
      .select("*")
      .maybeSingle();
    const result = row(assertOk(data, error));
    return result ? allowedUserFrom(result) : null;
  },

  async upsertAllowedUser(input: {
    email: string;
    invitedBy?: string | null;
    notes?: string | null;
    isActive?: boolean;
    isAdmin?: boolean;
  }) {
    const { data, error } = await db()
      .from("allowed_users")
      .upsert({
        email: input.email.toLowerCase(),
        invited_by: input.invitedBy ?? null,
        notes: input.notes ?? null,
        is_active: input.isActive ?? true,
        is_admin: input.isAdmin ?? false,
      })
      .select("*")
      .single();
    return allowedUserFrom(row(assertOk(data, error))!);
  },

  async ensureUserProfile(input: {
    userId: string;
    email: string;
    displayName: string;
    avatarUrl?: string | null;
    isAdmin?: boolean;
  }) {
    const existingResult = await db()
      .from("user_profiles")
      .select("*")
      .eq("user_id", input.userId)
      .maybeSingle();
    const existing = row(assertOk(existingResult.data, existingResult.error));
    const existingDisplayName = existing ? nullableText(existing.display_name) : null;
    const existingAvatarUrl = existing ? nullableText(existing.avatar_url) : null;
    const { data, error } = await db()
      .from("user_profiles")
      .upsert({
        user_id: input.userId,
        email: input.email.toLowerCase(),
        display_name: existingDisplayName ?? input.displayName,
        avatar_url: existing ? existingAvatarUrl : input.avatarUrl ?? null,
        is_admin: bool(existing?.is_admin) || Boolean(input.isAdmin),
      })
      .select("*")
      .single();
    const profile = userProfileFrom(row(assertOk(data, error))!);
    await this.applyPendingRoomMemberships(profile.email, profile.userId).catch(() => null);
    return profile;
  },

  async updateUserProfile(
    userId: string,
    patch: {
      displayName: string;
      avatarUrl?: string | null;
      bio?: string | null;
    },
  ) {
    const { data, error } = await db()
      .from("user_profiles")
      .update({
        display_name: patch.displayName,
        avatar_url: patch.avatarUrl ?? null,
        bio: patch.bio ?? null,
      })
      .eq("user_id", userId)
      .select("*")
      .maybeSingle();
    const result = row(assertOk(data, error));
    return result ? userProfileFrom(result) : null;
  },

  async upsertMembership(input: {
    userId: string;
    roomId: string;
    role: RoomMembership["role"];
  }) {
    const { data, error } = await db()
      .from("room_memberships")
      .upsert({
        user_id: input.userId,
        room_id: input.roomId,
        role: input.role,
      })
      .select("*")
      .single();
    return membershipFrom(row(assertOk(data, error))!);
  },

  async deleteMembership(input: { userId: string; roomId: string }) {
    const { data, error } = await db()
      .from("room_memberships")
      .delete()
      .eq("user_id", input.userId)
      .eq("room_id", input.roomId);
    assertOk(data, error);
    return { ok: true };
  },

  async listPendingRoomMemberships(email?: string) {
    let query = db()
      .from("pending_room_memberships")
      .select("*")
      .order("updated_at", { ascending: false });
    if (email) {
      query = query.eq("email", email.toLowerCase());
    }
    const { data, error } = await query;
    if (isPendingMembershipSchemaMissing(error)) {
      return this.listPendingRoomMembershipsFromAudit(email);
    }
    return rows(assertOk(data, error)).map(pendingMembershipFrom);
  },

  async upsertPendingRoomMembership(input: CreatePendingMembershipInput) {
    const now = new Date().toISOString();
    const normalizedEmail = input.email.toLowerCase();
    const { data, error } = await db()
      .from("pending_room_memberships")
      .upsert({
        email: normalizedEmail,
        room_id: input.roomId,
        role: input.role,
        assigned_by: input.assignedBy ?? null,
        updated_at: now,
      })
      .select("*")
      .single();
    if (isPendingMembershipSchemaMissing(error)) {
      const membership: PendingRoomMembership = {
        email: normalizedEmail,
        roomId: input.roomId,
        role: input.role,
        assignedBy: input.assignedBy ?? null,
        createdAt: now,
        updatedAt: now,
      };
      await this.addAuditLog({
        actorUserId: input.assignedBy ?? null,
        roomId: input.roomId,
        action: "pending_room_membership.upsert",
        targetType: "pending_room_membership",
        targetId: `${normalizedEmail}:${input.roomId}`,
        metadata: { membership },
      });
      return membership;
    }
    return pendingMembershipFrom(row(assertOk(data, error))!);
  },

  async deletePendingRoomMembership(input: { email: string; roomId: string; deletedBy?: string | null }) {
    const normalizedEmail = input.email.toLowerCase();
    const { data, error } = await db()
      .from("pending_room_memberships")
      .delete()
      .eq("email", normalizedEmail)
      .eq("room_id", input.roomId);
    if (isPendingMembershipSchemaMissing(error)) {
      await this.addAuditLog({
        actorUserId: input.deletedBy ?? null,
        roomId: input.roomId,
        action: "pending_room_membership.removed",
        targetType: "pending_room_membership",
        targetId: `${normalizedEmail}:${input.roomId}`,
        metadata: { email: normalizedEmail, roomId: input.roomId },
      });
      return { ok: true };
    }
    assertOk(data, error);
    return { ok: true };
  },

  async applyPendingRoomMemberships(email: string, userId: string) {
    const pending = await this.listPendingRoomMemberships(email);
    for (const membership of pending) {
      await this.upsertMembership({ userId, roomId: membership.roomId, role: membership.role });
      await this.deletePendingRoomMembership({ email, roomId: membership.roomId });
    }
    return pending;
  },

  async listPendingRoomMembershipsFromAudit(email?: string) {
    const { data, error } = await db()
      .from("audit_logs")
      .select("*")
      .in("action", ["pending_room_membership.upsert", "pending_room_membership.removed"])
      .order("created_at", { ascending: true })
      .limit(1000);
    const byKey = new Map<string, PendingRoomMembership>();
    for (const log of rows(assertOk(data, error)).map(auditFrom)) {
      if (log.action === "pending_room_membership.removed") {
        const removedEmail = text(log.metadata.email).toLowerCase();
        const removedRoomId = text(log.metadata.roomId);
        byKey.delete(`${removedEmail}:${removedRoomId}`);
        continue;
      }
      const membership = pendingMembershipFromJson(log.metadata.membership);
      if (membership) {
        byKey.set(`${membership.email}:${membership.roomId}`, membership);
      }
    }
    return [...byKey.values()]
      .filter((membership) => !email || membership.email === email.toLowerCase())
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async grantAllRoomMemberships(userId: string, role: RoomMembership["role"] = "admin") {
    const rooms = await this.listRooms();
    return Promise.all(rooms.map((room) => this.upsertMembership({ userId, roomId: room.id, role })));
  },

  async getAgent(agentId: string) {
    const { data, error } = await db().from("agents").select("*").eq("id", agentId).maybeSingle();
    const result = row(assertOk(data, error));
    if (!result && agentId === COORDINATOR_AGENT_ID) {
      return getCoordinatorAgent();
    }
    return result ? agentFrom(result) : null;
  },

  async getAgentByRoom(roomId: string) {
    const { data, error } = await db()
      .from("agents")
      .select("*")
      .eq("room_id", roomId)
      .eq("is_active", true)
      .maybeSingle();
    const result = row(assertOk(data, error));
    return result ? agentFrom(result) : null;
  },

  async updateAgentPersona(
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
    const current = await this.getAgent(agentId);
    if (!current) {
      return null;
    }

    const now = new Date().toISOString();
    const nextMetadata = {
      ...current.metadata,
      ...(input.metadata ?? {}),
      persona_draft: input.personaDraft ?? current.personaDraft,
      persona_published: input.personaPublished ?? current.personaPublished,
      persona_draft_updated_by: input.updatedBy ?? current.personaDraftUpdatedBy ?? null,
      persona_draft_updated_at: input.personaDraft ? now : current.personaDraftUpdatedAt ?? null,
      persona_published_by: input.publishedBy ?? current.personaPublishedBy ?? null,
      persona_published_at: input.personaPublished ? now : current.personaPublishedAt ?? null,
      anthropic_agent_version: input.anthropicAgentVersion ?? current.metadata.anthropic_agent_version ?? null,
    };
    const published = input.personaPublished ?? current.personaPublished;
    const result = await db()
      .from("agents")
      .update({
        persona_draft: input.personaDraft,
        persona_published: input.personaPublished,
        persona_draft_updated_by: input.personaDraft ? input.updatedBy ?? null : undefined,
        persona_draft_updated_at: input.personaDraft ? now : undefined,
        persona_published_by: input.personaPublished ? input.publishedBy ?? null : undefined,
        persona_published_at: input.personaPublished ? now : undefined,
        system_prompt: published?.role,
        guest_prompt: published?.guestPrompt,
        metadata: nextMetadata,
      })
      .eq("id", agentId)
      .select("*")
      .single();

    if (isAgentPersonaSchemaMissing(result.error)) {
      const fallback = await db()
        .from("agents")
        .update({
          system_prompt: published?.role,
          guest_prompt: published?.guestPrompt,
          metadata: nextMetadata,
        })
        .eq("id", agentId)
        .select("*")
        .single();
      return agentFrom(row(assertOk(fallback.data, fallback.error))!);
    }

    return agentFrom(row(assertOk(result.data, result.error))!);
  },

  async addAgentPersonaVersion(input: CreateAgentPersonaVersionInput) {
    const { data, error } = await db()
      .from("agent_persona_versions")
      .insert({
        agent_id: input.agentId,
        room_id: input.roomId,
        version_no: input.versionNo,
        persona: input.persona,
        anthropic_agent_id: input.anthropicAgentId ?? null,
        anthropic_agent_version: input.anthropicAgentVersion ?? null,
        published_by: input.publishedBy ?? null,
        metadata: input.metadata ?? {},
      })
      .select("*")
      .single();
    if (isAgentPersonaSchemaMissing(error)) {
      return null;
    }
    return agentPersonaVersionFrom(row(assertOk(data, error))!);
  },

  async listMemberships(userId?: string) {
    let query = db().from("room_memberships").select("*");
    if (userId) {
      query = query.eq("user_id", userId);
    }
    const { data, error } = await query;
    return rows(assertOk(data, error)).map(membershipFrom);
  },

  async getMembership(userId: string, roomId: string) {
    const { data, error } = await db()
      .from("room_memberships")
      .select("*")
      .eq("user_id", userId)
      .eq("room_id", roomId)
      .maybeSingle();
    const result = row(assertOk(data, error));
    return result ? membershipFrom(result) : null;
  },

  async listThreads(roomId: string) {
    const { data, error } = await db()
      .from("room_threads")
      .select("*")
      .eq("room_id", roomId)
      .order("last_message_at", { ascending: false });
    if (isThreadSchemaMissing(error)) {
      return [legacyThread(roomId)];
    }
    return rows(assertOk(data, error)).map(threadFrom);
  },

  async getThread(threadId: string) {
    const { data, error } = await db().from("room_threads").select("*").eq("id", threadId).maybeSingle();
    if (isThreadSchemaMissing(error) && threadId.endsWith("-legacy-thread")) {
      return legacyThread(threadId.slice(0, -"legacy-thread".length - 1));
    }
    const result = row(assertOk(data, error));
    return result ? threadFrom(result) : null;
  },

  async ensureRoomThread(roomId: string, input: Partial<CreateRoomThreadInput> = {}) {
    const threads = await this.listThreads(roomId);
    const existing = threads.find((thread) => thread.status === "active") ?? threads[0];
    if (existing) {
      return existing;
    }

    return this.createThread({
      roomId,
      title: input.title ?? "기본 대화",
      summary: input.summary ?? "",
      carryoverSummary: input.carryoverSummary ?? "",
      status: input.status ?? "active",
      createdBy: input.createdBy ?? null,
      metadata: { kind: "default", ...(input.metadata ?? {}) },
    });
  },

  async createThread(input: CreateRoomThreadInput) {
    const { data, error } = await db()
      .from("room_threads")
      .insert({
        room_id: input.roomId,
        title: input.title,
        summary: input.summary ?? "",
        carryover_summary: input.carryoverSummary ?? "",
        status: input.status ?? "active",
        last_message_at: input.lastMessageAt ?? new Date().toISOString(),
        created_by: input.createdBy ?? null,
        metadata: input.metadata ?? {},
      })
      .select("*")
      .single();
    if (isThreadSchemaMissing(error)) {
      const migrationError = new Error("room_threads migration이 아직 적용되지 않았습니다.") as Error & { status: number };
      migrationError.status = 503;
      throw migrationError;
    }
    return threadFrom(row(assertOk(data, error))!);
  },

  async updateThread(threadId: string, patch: Partial<RoomThread>) {
    const { data, error } = await db()
      .from("room_threads")
      .update({
        title: patch.title,
        summary: patch.summary,
        carryover_summary: patch.carryoverSummary,
        status: patch.status,
        last_message_at: patch.lastMessageAt,
        metadata: patch.metadata,
      })
      .eq("id", threadId)
      .select("*")
      .single();
    if (isThreadSchemaMissing(error) && threadId.endsWith("-legacy-thread")) {
      return { ...legacyThread(threadId.slice(0, -"legacy-thread".length - 1)), ...patch };
    }
    return threadFrom(row(assertOk(data, error))!);
  },

  async listMessages(roomId: string, threadId?: string | null) {
    let query = db()
      .from("room_messages")
      .select("*")
      .eq("room_id", roomId);
    if (threadId) {
      query = query.eq("thread_id", threadId);
    }
    const { data, error } = await query.order("created_at", { ascending: true });
    if (isThreadSchemaMissing(error)) {
      const fallback = await db()
        .from("room_messages")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });
      return rows(assertOk(fallback.data, fallback.error)).map(messageFrom);
    }
    return rows(assertOk(data, error)).map(messageFrom);
  },

  async createMessage(input: {
    roomId: string;
    threadId?: string | null;
    type: RoomMessage["type"];
    content: string;
    senderUserId?: string | null;
    senderAgentId?: string | null;
    agentRunId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const thread = input.threadId ? null : await this.ensureRoomThread(input.roomId);
    let result = await db()
      .from("room_messages")
      .insert({
        room_id: input.roomId,
        thread_id: input.threadId ?? thread?.id,
        type: input.type,
        content: input.content,
        sender_user_id: input.senderUserId ?? null,
        sender_agent_id: input.senderAgentId ?? null,
        agent_run_id: input.agentRunId ?? null,
        metadata: input.metadata ?? {},
      })
      .select("*")
      .single();
    if (isThreadSchemaMissing(result.error)) {
      result = await db()
        .from("room_messages")
        .insert({
          room_id: input.roomId,
          type: input.type,
          content: input.content,
          sender_user_id: input.senderUserId ?? null,
          sender_agent_id: input.senderAgentId ?? null,
          agent_run_id: input.agentRunId ?? null,
          metadata: input.metadata ?? {},
        })
        .select("*")
        .single();
    }
    const message = messageFrom(row(assertOk(result.data, result.error))!);
    await this.updateThread(message.threadId, { lastMessageAt: message.createdAt }).catch(() => null);
    return message;
  },

  async getMemory(roomId: string) {
    const { data, error } = await db().from("domain_memory").select("*").eq("room_id", roomId).maybeSingle();
    const result = row(assertOk(data, error));
    return result ? memoryFrom(result) : null;
  },

  async listRoomMemoryStores(roomId: string) {
    const { data, error } = await db()
      .from("room_memory_stores")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true });
    return rows(assertOk(data, error)).map(roomMemoryStoreFrom);
  },

  async updateMemory(roomId: string, patch: Partial<DomainMemory>) {
    const { data, error } = await db()
      .from("domain_memory")
      .update({
        summary: patch.summary,
        active_tasks: patch.activeTasks,
        decisions: patch.decisions,
        key_facts: patch.keyFacts,
        pending_context: patch.pendingContext,
        processed_context: patch.processedContext,
        metadata: patch.metadata,
        updated_by_agent_run: patch.updatedByAgentRun,
      })
      .eq("room_id", roomId)
      .select("*")
      .single();
    return memoryFrom(row(assertOk(data, error))!);
  },

  async appendPendingContext(roomId: string, context: Record<string, unknown>) {
    const current = await this.getMemory(roomId);
    if (!current) {
      return null;
    }
    const nextPending = [
      ...current.pendingContext,
      { id: crypto.randomUUID(), ...context, createdAt: new Date().toISOString() },
    ];
    return this.updateMemory(roomId, { ...current, pendingContext: nextPending });
  },

  async markPendingProcessed(roomId: string, contextIds: string[]) {
    const current = await this.getMemory(roomId);
    if (!current) {
      return null;
    }
    const moving = current.pendingContext.filter((context) => contextIds.includes(String(context.id)));
    const pendingContext = current.pendingContext.filter((context) => !contextIds.includes(String(context.id)));
    const processedContext = [
      ...current.processedContext,
      ...moving.map((context) => ({ ...context, processedAt: new Date().toISOString() })),
    ];
    return this.updateMemory(roomId, { ...current, pendingContext, processedContext });
  },

  async createAgentRun(input: Partial<AgentRun> & Pick<AgentRun, "roomId" | "mode" | "runType">) {
    const thread = input.threadId ? null : await this.ensureRoomThread(input.roomId);
    const storedAgentId = input.agentId === COORDINATOR_AGENT_ID ? null : input.agentId ?? null;
    const metadata = {
      ...(input.metadata ?? {}),
      ...(input.agentId === COORDINATOR_AGENT_ID
        ? { coordinatorAgentId: input.agentId, guestLabel: getCoordinatorAgent().name }
        : {}),
    };
    let result = await db()
      .from("agent_runs")
      .insert({
        room_id: input.roomId,
        thread_id: input.threadId ?? thread?.id,
        agent_id: storedAgentId,
        initiated_by: input.initiatedBy ?? null,
        anthropic_session_id: input.anthropicSessionId ?? null,
        mode: input.mode,
        run_type: input.runType,
        guest_source_room_id: input.guestSourceRoomId ?? null,
        status: input.status ?? "queued",
        input_message_id: input.inputMessageId ?? null,
        output_message_id: input.outputMessageId ?? null,
        session_summary: input.sessionSummary ?? null,
        token_usage: input.tokenUsage ?? {},
        error: input.error ?? null,
        ended_at: input.endedAt ?? null,
        metadata,
      })
      .select("*")
      .single();
    if (isThreadSchemaMissing(result.error)) {
      result = await db()
        .from("agent_runs")
        .insert({
          room_id: input.roomId,
          agent_id: storedAgentId,
          initiated_by: input.initiatedBy ?? null,
          anthropic_session_id: input.anthropicSessionId ?? null,
          mode: input.mode,
          run_type: input.runType,
          guest_source_room_id: input.guestSourceRoomId ?? null,
          status: input.status ?? "queued",
          input_message_id: input.inputMessageId ?? null,
          output_message_id: input.outputMessageId ?? null,
          session_summary: input.sessionSummary ?? null,
          token_usage: input.tokenUsage ?? {},
          error: input.error ?? null,
          ended_at: input.endedAt ?? null,
          metadata,
        })
        .select("*")
        .single();
    }
    return agentRunFrom(row(assertOk(result.data, result.error))!);
  },

  async updateAgentRun(runId: string, patch: Partial<AgentRun>) {
    const { data, error } = await db()
      .from("agent_runs")
      .update({
        thread_id: patch.threadId,
        status: patch.status,
        anthropic_session_id: patch.anthropicSessionId,
        output_message_id: patch.outputMessageId,
        session_summary: patch.sessionSummary,
        token_usage: patch.tokenUsage,
        error: patch.error,
        ended_at: patch.endedAt,
        metadata: patch.metadata,
      })
      .eq("id", runId)
      .select("*")
      .single();
    return agentRunFrom(row(assertOk(data, error))!);
  },

  async listAgentRuns() {
    const { data, error } = await db().from("agent_runs").select("*").order("started_at", { ascending: false });
    return rows(assertOk(data, error)).map(agentRunFrom);
  },

  async addAgentRunEvent(agentRunId: string, eventType: string, payload: Record<string, unknown>) {
    const { data, error } = await db()
      .from("agent_run_events")
      .insert({ agent_run_id: agentRunId, event_type: eventType, payload })
      .select("*")
      .single();
    return agentRunEventFrom(row(assertOk(data, error))!);
  },

  async listAgentRunEvents(agentRunId?: string) {
    let query = db().from("agent_run_events").select("*").order("created_at", { ascending: true });
    if (agentRunId) {
      query = query.eq("agent_run_id", agentRunId);
    }
    const { data, error } = await query;
    return rows(assertOk(data, error)).map(agentRunEventFrom);
  },

  async listSharedItems(roomId?: string) {
    let query = db().from("shared_items").select("*").order("created_at", { ascending: false });
    if (roomId) {
      query = query.or(`source_room_id.eq.${roomId},target_room_id.eq.${roomId}`);
    }
    const { data, error } = await query;
    return rows(assertOk(data, error))
      .map(sharedItemFrom)
      .filter((item) => !item.metadata.deletedAt);
  },

  async createSharedItem(input: CreateSharedItemInput) {
    const { data, error } = await db()
      .from("shared_items")
      .insert({
        source_room_id: input.sourceRoomId,
        target_room_id: input.targetRoomId ?? "meeting",
        source_message_id: input.sourceMessageId ?? null,
        source_file_id: input.sourceFileId ?? null,
        title: input.title,
        summary: input.summary,
        shared_by: input.sharedBy ?? null,
        metadata: input.metadata ?? {},
      })
      .select("*")
      .single();
    return sharedItemFrom(row(assertOk(data, error))!);
  },

  async deleteSharedItem(sharedItemId: string, deletedBy?: string | null) {
    const currentResult = await db()
      .from("shared_items")
      .select("*")
      .eq("id", sharedItemId)
      .maybeSingle();
    const current = row(assertOk(currentResult.data, currentResult.error));
    if (!current) {
      return null;
    }
    const currentItem = sharedItemFrom(current);
    const { data, error } = await db()
      .from("shared_items")
      .update({
        metadata: {
          ...currentItem.metadata,
          deletedAt: new Date().toISOString(),
          deletedBy: deletedBy ?? null,
        },
      })
      .eq("id", sharedItemId)
      .select("*")
      .single();
    return sharedItemFrom(row(assertOk(data, error))!);
  },

  async listImports(roomId?: string) {
    let query = db().from("meeting_imports").select("*").order("created_at", { ascending: false });
    if (roomId) {
      query = query.or(`meeting_room_id.eq.${roomId},target_room_id.eq.${roomId}`);
    }
    const { data, error } = await query;
    return rows(assertOk(data, error))
      .map(importFrom)
      .filter((item) => item.status !== "dismissed");
  },

  async createImport(input: CreateImportInput) {
    const { data, error } = await db()
      .from("meeting_imports")
      .insert({
        meeting_room_id: input.meetingRoomId ?? "meeting",
        target_room_id: input.targetRoomId,
        shared_item_id: input.sharedItemId ?? null,
        source_message_id: input.sourceMessageId ?? null,
        source_file_id: input.sourceFileId ?? null,
        imported_by: input.importedBy ?? null,
        status: input.status ?? "pending",
        metadata: input.metadata ?? {},
      })
      .select("*")
      .single();
    return importFrom(row(assertOk(data, error))!);
  },

  async updateImport(importId: string, patch: Partial<MeetingImport>) {
    const update: Record<string, unknown> = {};
    if (patch.status) {
      update.status = patch.status;
    }
    if (patch.metadata) {
      update.metadata = patch.metadata;
    }
    const { data, error } = await db()
      .from("meeting_imports")
      .update(update)
      .eq("id", importId)
      .select("*")
      .single();
    return importFrom(row(assertOk(data, error))!);
  },

  async listFiles(roomId: string) {
    const { data, error } = await db()
      .from("file_room_access")
      .select("access_level, files(*)")
      .eq("room_id", roomId);
    return rows(assertOk(data, error)).flatMap((accessRow) => {
      const fileRow = row(accessRow.files);
      return fileRow ? [fileFrom({ ...fileRow, access_level: accessRow.access_level })] : [];
    });
  },

  async addFile(input: {
    roomId: string;
    storagePath: string;
    originalName: string;
    uploadedBy?: string | null;
    sizeBytes?: number | null;
    mimeType?: string | null;
    checksum?: string | null;
    agentRunId?: string | null;
  }) {
    const { data, error } = await db()
      .from("files")
      .insert({
        storage_path: input.storagePath,
        original_name: input.originalName,
        uploaded_by: input.uploadedBy ?? null,
        size_bytes: input.sizeBytes ?? 0,
        mime_type: input.mimeType ?? "application/octet-stream",
        checksum: input.checksum ?? null,
      })
      .select("*")
      .single();
    const fileRow = row(assertOk(data, error))!;
    const fileId = text(fileRow.id);
    const versionInsert = await db()
      .from("file_versions")
      .insert({
        file_id: fileId,
        version_no: 1,
        storage_path: input.storagePath,
        created_by: input.uploadedBy ?? null,
        agent_run_id: input.agentRunId ?? null,
        change_summary: "Initial upload",
      });
    assertOk(versionInsert.data, versionInsert.error);
    const accessInsert = await db()
      .from("file_room_access")
      .insert({
        file_id: fileId,
        room_id: input.roomId,
        access_level: "owner",
        added_by: input.uploadedBy ?? null,
      });
    assertOk(accessInsert.data, accessInsert.error);
    return fileFrom({ ...fileRow, version_no: 1, access_level: "owner" });
  },

  async createFileVersion(input: {
    fileId: string;
    storagePath: string;
    createdBy?: string | null;
    changeSummary: string;
    agentRunId?: string | null;
  }) {
    const versions = await db()
      .from("file_versions")
      .select("*")
      .eq("file_id", input.fileId)
      .order("version_no", { ascending: false })
      .limit(1);
    const last = rows(assertOk(versions.data, versions.error))[0];
    const nextVersion = numberValue(last?.version_no, 0) + 1;
    const insert = await db()
      .from("file_versions")
      .insert({
        file_id: input.fileId,
        version_no: nextVersion,
        storage_path: input.storagePath,
        created_by: input.createdBy ?? null,
        agent_run_id: input.agentRunId ?? null,
        change_summary: input.changeSummary,
      });
    assertOk(insert.data, insert.error);
    const fileResult = await db().from("files").select("*").eq("id", input.fileId).single();
    return fileFrom({
      ...row(assertOk(fileResult.data, fileResult.error))!,
      version_no: nextVersion,
      access_level: "write",
    });
  },

  async listDecisions(roomId?: string) {
    let query = db().from("decisions").select("*").order("created_at", { ascending: false });
    if (roomId) {
      query = query.eq("room_id", roomId);
    }
    const { data, error } = await query;
    return rows(assertOk(data, error)).map(decisionFrom);
  },

  async createDecision(input: CreateDecisionInput) {
    const { data, error } = await db()
      .from("decisions")
      .insert({
        room_id: input.roomId,
        source_message_id: input.sourceMessageId ?? null,
        title: input.title,
        description: input.description ?? null,
        decided_by: input.decidedBy ?? null,
      })
      .select("*")
      .single();
    return decisionFrom(row(assertOk(data, error))!);
  },

  async updateDecision(decisionId: string, patch: Partial<Decision>) {
    const update: Record<string, unknown> = {};
    if (patch.title !== undefined) {
      update.title = patch.title;
    }
    if (patch.description !== undefined) {
      update.description = patch.description;
    }
    const { data, error } = await db()
      .from("decisions")
      .update(update)
      .eq("id", decisionId)
      .select("*")
      .single();
    return decisionFrom(row(assertOk(data, error))!);
  },

  async deleteDecision(decisionId: string) {
    const { data, error } = await db().from("decisions").delete().eq("id", decisionId).select("*");
    assertOk(data, error);
    return rows(data).length > 0;
  },

  async listTasks(roomId?: string) {
    const { data, error } = await db().from("tasks").select("*").order("created_at", { ascending: false });
    const tasks = rows(assertOk(data, error)).map(taskFrom);
    return roomId ? tasks.filter((task) => isTaskVisibleInRoom(task, roomId)) : tasks;
  },

  async createTask(input: CreateTaskInput) {
    const { data, error } = await db()
      .from("tasks")
      .insert({
        room_id: input.roomId,
        decision_id: input.decisionId ?? null,
        title: input.title,
        description: input.description ?? null,
        assignee_user_id: input.assigneeUserId ?? null,
        assignee_room_id: input.assigneeRoomId ?? null,
        status: input.status ?? "todo",
        due_at: input.dueAt ?? null,
        created_by: input.createdBy ?? null,
      })
      .select("*")
      .single();
    return taskFrom(row(assertOk(data, error))!);
  },

  async addAuditLog(input: CreateAuditInput) {
    const { data, error } = await db()
      .from("audit_logs")
      .insert({
        actor_user_id: input.actorUserId ?? null,
        actor_agent_id: input.actorAgentId ?? null,
        room_id: input.roomId ?? null,
        action: input.action,
        target_type: input.targetType ?? null,
        target_id: input.targetId ?? null,
        metadata: input.metadata ?? {},
      })
      .select("*")
      .single();
    return auditFrom(row(assertOk(data, error))!);
  },

  async listAuditLogs() {
    const { data, error } = await db().from("audit_logs").select("*").order("created_at", { ascending: false }).limit(100);
    return rows(assertOk(data, error)).map(auditFrom);
  },

  async listMemoryReviews() {
    const { data, error } = await db()
      .from("memory_write_reviews")
      .select("*")
      .order("created_at", { ascending: false });
    return rows(assertOk(data, error)).map(memoryReviewFrom);
  },

  async addMemoryReview(input: CreateMemoryReviewInput) {
    const { data, error } = await db()
      .from("memory_write_reviews")
      .insert({
        room_id: input.roomId,
        agent_run_id: input.agentRunId ?? null,
        proposed_memory: input.proposedMemory,
        status: input.status ?? "pending",
        reviewed_by: input.reviewedBy ?? null,
        reviewed_at: input.reviewedAt ?? null,
      })
      .select("*")
      .single();
    return memoryReviewFrom(row(assertOk(data, error))!);
  },

  async listVideoMeetings(roomId?: string, status?: string) {
    let query = db().from("video_meetings").select("*").order("created_at", { ascending: false });
    if (roomId) {
      query = query.eq("room_id", roomId);
    }
    if (status) {
      query = query.eq("status", status);
    }
    const { data, error } = await query;
    return rows(assertOk(data, error)).map(videoMeetingFrom);
  },

  async getVideoMeeting(meetingId: string) {
    const { data, error } = await db().from("video_meetings").select("*").eq("id", meetingId).maybeSingle();
    const result = row(assertOk(data, error));
    return result ? videoMeetingFrom(result) : null;
  },

  async createVideoMeeting(input: CreateVideoMeetingInput) {
    const { data, error } = await db()
      .from("video_meetings")
      .insert({
        room_id: input.roomId,
        provider: input.provider,
        title: input.title,
        description: input.description ?? null,
        status: input.status ?? "scheduled",
        provider_space_name: input.providerSpaceName ?? null,
        provider_conference_name: input.providerConferenceName ?? null,
        provider_meeting_id: input.providerMeetingId ?? null,
        provider_meeting_code: input.providerMeetingCode ?? null,
        join_url: input.joinUrl ?? null,
        host_url: input.hostUrl ?? null,
        embed_allowed: input.embedAllowed ?? false,
        scheduled_start_at: input.scheduledStartAt ?? null,
        started_at: input.startedAt ?? null,
        ended_at: input.endedAt ?? null,
        created_by: input.createdBy ?? null,
        ended_by: input.endedBy ?? null,
        consent_recording: input.consentRecording ?? false,
        consent_transcript: input.consentTranscript ?? false,
        consent_ai_summary: input.consentAiSummary ?? true,
        metadata: input.metadata ?? {},
      })
      .select("*")
      .single();
    return videoMeetingFrom(row(assertOk(data, error))!);
  },

  async updateVideoMeeting(meetingId: string, patch: Partial<VideoMeeting>) {
    const { data, error } = await db()
      .from("video_meetings")
      .update({
        status: patch.status,
        join_url: patch.joinUrl,
        started_at: patch.startedAt,
        ended_at: patch.endedAt,
        ended_by: patch.endedBy,
        metadata: patch.metadata,
      })
      .eq("id", meetingId)
      .select("*")
      .single();
    return videoMeetingFrom(row(assertOk(data, error))!);
  },

  async addVideoArtifact(input: CreateVideoArtifactInput) {
    const { data, error } = await db()
      .from("video_meeting_artifacts")
      .insert({
        video_meeting_id: input.videoMeetingId,
        artifact_type: input.artifactType,
        title: input.title,
        content: input.content ?? null,
        external_url: input.externalUrl ?? null,
        file_id: input.fileId ?? null,
        provider_artifact_name: input.providerArtifactName ?? null,
        status: input.status ?? "available",
        created_by: input.createdBy ?? null,
        metadata: input.metadata ?? {},
      })
      .select("*")
      .single();
    return videoArtifactFrom(row(assertOk(data, error))!);
  },

  async listVideoArtifacts(meetingId: string) {
    const { data, error } = await db()
      .from("video_meeting_artifacts")
      .select("*")
      .eq("video_meeting_id", meetingId)
      .order("created_at", { ascending: false });
    return rows(assertOk(data, error)).map(videoArtifactFrom);
  },

  async addVideoEvent(input: CreateVideoEventInput) {
    const { data, error } = await db()
      .from("video_meeting_events")
      .insert({
        video_meeting_id: input.videoMeetingId,
        room_id: input.roomId,
        event_type: input.eventType,
        actor_user_id: input.actorUserId ?? null,
        payload: input.payload ?? {},
      })
      .select("*")
      .single();
    return videoEventFrom(row(assertOk(data, error))!);
  },

  async listRoomBriefings(roomId?: string, limit = 20) {
    let query = db().from("room_briefings").select("*").order("created_at", { ascending: false }).limit(limit);
    if (roomId) {
      query = query.eq("room_id", roomId);
    }
    const { data, error } = await query;
    if (isCoordinatorBriefingSchemaMissing(error)) {
      let fallbackQuery = db()
        .from("audit_logs")
        .select("*")
        .eq("action", "room_briefing.generated")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (roomId) {
        fallbackQuery = fallbackQuery.eq("room_id", roomId);
      }
      const fallback = await fallbackQuery;
      return rows(assertOk(fallback.data, fallback.error))
        .map(auditFrom)
        .map((log) => roomBriefingFromJson(log.metadata.briefing))
        .filter((briefing): briefing is RoomBriefing => Boolean(briefing));
    }
    return rows(assertOk(data, error)).map(roomBriefingFrom);
  },

  async createRoomBriefing(input: CreateRoomBriefingInput) {
    const { data, error } = await db()
      .from("room_briefings")
      .insert({
        room_id: input.roomId,
        agent_id: input.agentId ?? null,
        period_start: input.periodStart,
        period_end: input.periodEnd,
        summary: input.summary,
        risks: input.risks ?? [],
        next_actions: input.nextActions ?? [],
        blocked_items: input.blockedItems ?? [],
        source_counts: input.sourceCounts ?? {},
        status: input.status ?? "ready",
        created_by: input.createdBy ?? null,
        metadata: input.metadata ?? {},
      })
      .select("*")
      .single();
    if (isCoordinatorBriefingSchemaMissing(error)) {
      const fallback = fallbackRoomBriefing(input);
      await this.addAuditLog({
        actorUserId: input.createdBy ?? null,
        actorAgentId: input.agentId ?? null,
        roomId: input.roomId,
        action: "room_briefing.generated",
        targetType: "room_briefing",
        targetId: fallback.id,
        metadata: { briefing: fallback },
      });
      return fallback;
    }
    return roomBriefingFrom(row(assertOk(data, error))!);
  },

  async listCoordinatorBriefings(limit = 10) {
    const { data, error } = await db()
      .from("coordinator_briefings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (isCoordinatorBriefingSchemaMissing(error)) {
      const fallback = await db()
        .from("audit_logs")
        .select("*")
        .eq("action", "coordinator_briefing.generated")
        .order("created_at", { ascending: false })
        .limit(Math.max(limit * 4, 20));
      return rows(assertOk(fallback.data, fallback.error))
        .map(auditFrom)
        .map((log) => coordinatorBriefingFromJson(log.metadata.briefing))
        .filter((briefing): briefing is CoordinatorBriefing => Boolean(briefing))
        .slice(0, limit);
    }
    return rows(assertOk(data, error)).map(coordinatorBriefingFrom);
  },

  async createCoordinatorBriefing(input: CreateCoordinatorBriefingInput) {
    const { data, error } = await db()
      .from("coordinator_briefings")
      .insert({
        period_start: input.periodStart,
        period_end: input.periodEnd,
        summary: input.summary,
        room_highlights: input.roomHighlights ?? [],
        cross_room_risks: input.crossRoomRisks ?? [],
        decisions_needed: input.decisionsNeeded ?? [],
        next_actions: input.nextActions ?? [],
        source_room_briefing_ids: input.sourceRoomBriefingIds ?? [],
        created_by: input.createdBy ?? null,
        metadata: input.metadata ?? {},
      })
      .select("*")
      .single();
    if (isCoordinatorBriefingSchemaMissing(error)) {
      const fallback = fallbackCoordinatorBriefing(input);
      await this.addAuditLog({
        actorUserId: input.createdBy ?? null,
        roomId: "meeting",
        action: "coordinator_briefing.generated",
        targetType: "coordinator_briefing",
        targetId: fallback.id,
        metadata: { briefing: fallback },
      });
      return fallback;
    }
    return coordinatorBriefingFrom(row(assertOk(data, error))!);
  },
};
