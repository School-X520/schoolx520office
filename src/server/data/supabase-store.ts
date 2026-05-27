import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  Agent,
  AgentRun,
  AgentRunEvent,
  AllowedUser,
  AuditLog,
  Decision,
  DomainMemory,
  FileRecord,
  MeetingImport,
  MemoryWriteReview,
  Room,
  RoomMembership,
  RoomMessage,
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
type CreateImportInput = Pick<MeetingImport, "targetRoomId"> & Partial<Omit<MeetingImport, "id" | "createdAt">>;
type CreateDecisionInput = Pick<Decision, "roomId" | "title"> & Partial<Omit<Decision, "id" | "createdAt">>;
type CreateTaskInput = Pick<Task, "roomId" | "title"> & Partial<Omit<Task, "id" | "createdAt" | "updatedAt">>;
type CreateAuditInput = Pick<AuditLog, "action"> & Partial<Omit<AuditLog, "id" | "createdAt">>;
type CreateMemoryReviewInput = Pick<MemoryWriteReview, "roomId" | "proposedMemory"> &
  Partial<Omit<MemoryWriteReview, "id" | "createdAt">>;
type CreateVideoMeetingInput = Pick<VideoMeeting, "roomId" | "provider" | "title"> &
  Partial<Omit<VideoMeeting, "id" | "createdAt" | "updatedAt">>;
type CreateVideoArtifactInput = Pick<VideoMeetingArtifact, "videoMeetingId" | "artifactType" | "title"> &
  Partial<Omit<VideoMeetingArtifact, "id" | "createdAt">>;
type CreateVideoEventInput = Pick<VideoMeetingEvent, "videoMeetingId" | "roomId" | "eventType"> &
  Partial<Omit<VideoMeetingEvent, "id" | "createdAt">>;

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
    isAdmin: bool(rowValue.is_admin),
    createdAt: text(rowValue.created_at),
    updatedAt: text(rowValue.updated_at),
  };
}

function agentFrom(rowValue: Record<string, unknown>): Agent {
  return {
    id: text(rowValue.id),
    roomId: text(rowValue.room_id),
    name: text(rowValue.name),
    role: text(rowValue.role),
    anthropicAgentId: nullableText(rowValue.anthropic_agent_id),
    anthropicEnvironmentId: nullableText(rowValue.anthropic_environment_id),
    defaultModel: text(rowValue.default_model, "claude-sonnet-4-5"),
    systemPrompt: text(rowValue.system_prompt),
    guestPrompt: text(rowValue.guest_prompt),
    isActive: bool(rowValue.is_active, true),
    metadata: jsonObject(rowValue.metadata),
    createdAt: text(rowValue.created_at),
    updatedAt: text(rowValue.updated_at),
  };
}

function messageFrom(rowValue: Record<string, unknown>): RoomMessage {
  return {
    id: text(rowValue.id),
    roomId: text(rowValue.room_id),
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

function agentRunFrom(rowValue: Record<string, unknown>): AgentRun {
  return {
    id: text(rowValue.id),
    roomId: text(rowValue.room_id),
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

function sharedItemFrom(rowValue: Record<string, unknown>): SharedItem {
  return {
    id: text(rowValue.id),
    sourceRoomId: text(rowValue.source_room_id),
    targetRoomId: text(rowValue.target_room_id, "meeting"),
    sourceMessageId: nullableText(rowValue.source_message_id),
    sourceFileId: nullableText(rowValue.source_file_id),
    title: text(rowValue.title),
    summary: text(rowValue.summary),
    sharedBy: nullableText(rowValue.shared_by),
    createdAt: text(rowValue.created_at),
    metadata: jsonObject(rowValue.metadata),
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
  };
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
    const { data, error } = await db()
      .from("user_profiles")
      .upsert({
        user_id: input.userId,
        email: input.email.toLowerCase(),
        display_name: input.displayName,
        avatar_url: input.avatarUrl ?? null,
        is_admin: bool(existing?.is_admin) || Boolean(input.isAdmin),
      })
      .select("*")
      .single();
    return userProfileFrom(row(assertOk(data, error))!);
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

  async grantAllRoomMemberships(userId: string, role: RoomMembership["role"] = "admin") {
    const rooms = await this.listRooms();
    return Promise.all(rooms.map((room) => this.upsertMembership({ userId, roomId: room.id, role })));
  },

  async getAgent(agentId: string) {
    const { data, error } = await db().from("agents").select("*").eq("id", agentId).maybeSingle();
    const result = row(assertOk(data, error));
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

  async listMessages(roomId: string) {
    const { data, error } = await db()
      .from("room_messages")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true });
    return rows(assertOk(data, error)).map(messageFrom);
  },

  async createMessage(input: {
    roomId: string;
    type: RoomMessage["type"];
    content: string;
    senderUserId?: string | null;
    senderAgentId?: string | null;
    agentRunId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const { data, error } = await db()
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
    return messageFrom(row(assertOk(data, error))!);
  },

  async getMemory(roomId: string) {
    const { data, error } = await db().from("domain_memory").select("*").eq("room_id", roomId).maybeSingle();
    const result = row(assertOk(data, error));
    return result ? memoryFrom(result) : null;
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
    const { data, error } = await db()
      .from("agent_runs")
      .insert({
        room_id: input.roomId,
        agent_id: input.agentId ?? null,
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
        metadata: input.metadata ?? {},
      })
      .select("*")
      .single();
    return agentRunFrom(row(assertOk(data, error))!);
  },

  async updateAgentRun(runId: string, patch: Partial<AgentRun>) {
    const { data, error } = await db()
      .from("agent_runs")
      .update({
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
    const result = row(assertOk(data, error))!;
    return {
      id: text(result.id),
      agentRunId: text(result.agent_run_id),
      anthropicEventId: nullableText(result.anthropic_event_id),
      eventType: text(result.event_type),
      payload: jsonObject(result.payload),
      createdAt: text(result.created_at),
    } satisfies AgentRunEvent;
  },

  async listSharedItems(roomId?: string) {
    let query = db().from("shared_items").select("*").order("created_at", { ascending: false });
    if (roomId) {
      query = query.or(`source_room_id.eq.${roomId},target_room_id.eq.${roomId}`);
    }
    const { data, error } = await query;
    return rows(assertOk(data, error)).map(sharedItemFrom);
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

  async listImports(roomId?: string) {
    let query = db().from("meeting_imports").select("*").order("created_at", { ascending: false });
    if (roomId) {
      query = query.or(`meeting_room_id.eq.${roomId},target_room_id.eq.${roomId}`);
    }
    const { data, error } = await query;
    return rows(assertOk(data, error)).map(importFrom);
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

  async listTasks(roomId?: string) {
    let query = db().from("tasks").select("*").order("created_at", { ascending: false });
    if (roomId) {
      query = query.or(`room_id.eq.${roomId},assignee_room_id.eq.${roomId}`);
    }
    const { data, error } = await query;
    return rows(assertOk(data, error)).map(taskFrom);
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
};
