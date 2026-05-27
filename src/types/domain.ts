export type RoomType = "department" | "project" | "meeting";
export type RoomRole = "admin" | "member" | "observer";
export type MessageType =
  | "human"
  | "agent"
  | "guest_agent"
  | "shared_item"
  | "meeting_import"
  | "system"
  | "video_meeting";

export type AgentRunMode = "room" | "meeting_guest" | "finalizer" | "memory_review";
export type AgentRunType =
  | "room_agent"
  | "meeting_guest"
  | "finalizer"
  | "memory_review"
  | "video_meeting_summary";
export type AgentRunStatus =
  | "queued"
  | "running"
  | "requires_action"
  | "idle"
  | "completed"
  | "failed"
  | "cancelled";

export type MeetingStatus = "scheduled" | "live" | "ended" | "canceled" | "failed";
export type VideoProviderId = "google_meet" | "zoom";

export type JsonObject = Record<string, unknown>;

export type Room = {
  id: string;
  name: string;
  type: RoomType;
  icon: string;
  description: string;
  defaultModel?: string;
  displayOrder: number;
  layoutX: number;
  layoutY: number;
  isActive: boolean;
  createdAt: string;
};

export type AllowedUser = {
  email: string;
  invitedBy?: string | null;
  invitedAt: string;
  notes?: string | null;
  isActive: boolean;
  isAdmin?: boolean;
};

export type UserProfile = {
  userId: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RoomMembership = {
  userId: string;
  roomId: string;
  role: RoomRole;
  joinedAt: string;
};

export type Agent = {
  id: string;
  roomId: string;
  name: string;
  role: string;
  anthropicAgentId?: string | null;
  anthropicEnvironmentId?: string | null;
  defaultModel: string;
  systemPrompt: string;
  guestPrompt: string;
  isActive: boolean;
  metadata: JsonObject;
  createdAt: string;
  updatedAt: string;
};

export type RoomMessage = {
  id: string;
  roomId: string;
  senderUserId?: string | null;
  senderAgentId?: string | null;
  agentRunId?: string | null;
  type: MessageType;
  content: string;
  metadata: JsonObject;
  createdAt: string;
};

export type AgentRun = {
  id: string;
  roomId: string;
  agentId?: string | null;
  initiatedBy?: string | null;
  anthropicSessionId?: string | null;
  mode: AgentRunMode;
  runType: AgentRunType;
  guestSourceRoomId?: string | null;
  status: AgentRunStatus;
  inputMessageId?: string | null;
  outputMessageId?: string | null;
  sessionSummary?: string | null;
  tokenUsage: JsonObject;
  error?: string | null;
  startedAt: string;
  endedAt?: string | null;
  metadata: JsonObject;
};

export type AgentRunEvent = {
  id: string;
  agentRunId: string;
  anthropicEventId?: string | null;
  eventType: string;
  payload: JsonObject;
  createdAt: string;
};

export type DomainMemory = {
  roomId: string;
  summary: string;
  activeTasks: JsonObject[];
  decisions: JsonObject[];
  keyFacts: JsonObject[];
  pendingContext: JsonObject[];
  processedContext: JsonObject[];
  metadata: JsonObject;
  updatedAt: string;
  updatedByAgentRun?: string | null;
};

export type FileRecord = {
  id: string;
  storagePath: string;
  originalName: string;
  uploadedBy?: string | null;
  sizeBytes: number;
  mimeType: string;
  checksum?: string | null;
  createdAt: string;
  versionNo: number;
  accessLevel: "read" | "write" | "owner";
};

export type SharedItem = {
  id: string;
  sourceRoomId: string;
  targetRoomId: string;
  sourceMessageId?: string | null;
  sourceFileId?: string | null;
  title: string;
  summary: string;
  sharedBy?: string | null;
  createdAt: string;
  metadata: JsonObject;
};

export type MeetingImport = {
  id: string;
  meetingRoomId: string;
  targetRoomId: string;
  sharedItemId?: string | null;
  sourceMessageId?: string | null;
  sourceFileId?: string | null;
  importedBy?: string | null;
  status: "pending" | "processed" | "dismissed";
  createdAt: string;
  metadata: JsonObject;
};

export type Decision = {
  id: string;
  roomId: string;
  sourceMessageId?: string | null;
  title: string;
  description?: string | null;
  decidedBy?: string | null;
  createdAt: string;
};

export type Task = {
  id: string;
  roomId: string;
  decisionId?: string | null;
  title: string;
  description?: string | null;
  assigneeUserId?: string | null;
  assigneeRoomId?: string | null;
  status: "todo" | "doing" | "done" | "cancelled";
  dueAt?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuditLog = {
  id: string;
  actorUserId?: string | null;
  actorAgentId?: string | null;
  roomId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata: JsonObject;
  createdAt: string;
};

export type MemoryWriteReview = {
  id: string;
  roomId: string;
  agentRunId?: string | null;
  proposedMemory: JsonObject;
  status: "pending" | "approved" | "rejected" | "applied";
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
};

export type VideoMeeting = {
  id: string;
  roomId: string;
  provider: VideoProviderId;
  title: string;
  description?: string | null;
  status: MeetingStatus;
  providerSpaceName?: string | null;
  providerConferenceName?: string | null;
  providerMeetingId?: string | null;
  providerMeetingCode?: string | null;
  joinUrl?: string | null;
  hostUrl?: string | null;
  embedAllowed: boolean;
  scheduledStartAt?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  createdBy?: string | null;
  endedBy?: string | null;
  consentRecording: boolean;
  consentTranscript: boolean;
  consentAiSummary: boolean;
  metadata: JsonObject;
  createdAt: string;
  updatedAt: string;
};

export type VideoMeetingArtifact = {
  id: string;
  videoMeetingId: string;
  artifactType:
    | "recording"
    | "transcript"
    | "transcript_entry"
    | "ai_summary"
    | "manual_minutes"
    | "provider_metadata";
  title: string;
  content?: string | null;
  externalUrl?: string | null;
  fileId?: string | null;
  providerArtifactName?: string | null;
  status: "pending" | "available" | "failed" | "restricted";
  createdBy?: string | null;
  metadata: JsonObject;
  createdAt: string;
};

export type VideoMeetingEvent = {
  id: string;
  videoMeetingId: string;
  roomId: string;
  eventType: string;
  actorUserId?: string | null;
  payload: JsonObject;
  createdAt: string;
};

export type RoomViewModel = {
  room: Room;
  agent?: Agent;
  guestAgents?: Agent[];
  membership?: RoomMembership;
  memory: DomainMemory;
  messages: RoomMessage[];
  files: FileRecord[];
  sharedItems: SharedItem[];
  imports: MeetingImport[];
  decisions: Decision[];
  tasks: Task[];
  activeMeeting?: VideoMeeting | null;
};
