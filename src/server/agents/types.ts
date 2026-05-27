import type { AgentRunMode, FileRecord } from "@/types/domain";

export type AgentMemoryAttachment = {
  roomId: string;
  memoryStoreId?: string | null;
  accessMode: "read_only" | "read_write";
  purpose: string;
};

export type AgentToolCallRequest = {
  agentRunId: string;
  toolName: string;
  input: Record<string, unknown>;
};

export type AgentStreamEvent = {
  type: string;
  payload: Record<string, unknown>;
};

export type AgentRunInput = {
  agentRunId: string;
  roomId: string;
  threadId: string;
  agentId: string;
  userId: string;
  message: string;
  mode: AgentRunMode;
  guestSourceRoomId?: string | null;
  startupContext?: Record<string, unknown>;
  memoryAttachments?: AgentMemoryAttachment[];
};

export type AgentRunResult = {
  content: string;
  anthropicSessionId?: string | null;
  tokenUsage?: Record<string, unknown>;
  events?: AgentStreamEvent[];
  generatedFiles?: FileRecord[];
  requiresAction?: boolean;
};

export interface AgentAdapter {
  run(input: AgentRunInput): Promise<AgentRunResult>;
}
