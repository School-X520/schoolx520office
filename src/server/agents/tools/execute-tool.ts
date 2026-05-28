import "server-only";

import { shouldUseMockData } from "@/lib/env";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";
import { requireRoomMember } from "@/server/auth/require-room-member";
import { shareMessageToMeeting, importMeetingMessageToRoom } from "@/server/collaboration/share-import-service";
import { toolRegistry } from "@/server/agents/tools/tool-registry";
import { agentFileMountPath, readRoomFileForAgent } from "@/server/files/file-service";
import { hasAllRoomSearchAccess } from "@/lib/agents/development-agent";
import type { AgentRun, RoomMessage } from "@/types/domain";

export async function executeTool(agentRunId: string, toolName: string, input: Record<string, unknown>) {
  const source = shouldUseMockData() ? mockStore : supabaseStore;
  const run = (await source.listAgentRuns()).find((item) => item.id === agentRunId);
  const definition = toolRegistry.find((tool) => tool.name === toolName);

  if (!run || !definition) {
    return { ok: false, error: "invalid_agent_run_or_tool" };
  }

  try {
    await source.addAuditLog({
      actorUserId: run.initiatedBy ?? undefined,
      actorAgentId: run.agentId ?? undefined,
      roomId: run.roomId,
      action: "agent.tool.called",
      targetType: "agent_tool_call",
      targetId: agentRunId,
      metadata: { toolName, input, risk: definition.risk, writes: definition.writes },
    });

    const data = await runTool(run, toolName, input);

    await source.addAuditLog({
      actorUserId: run.initiatedBy ?? undefined,
      actorAgentId: run.agentId ?? undefined,
      roomId: run.roomId,
      action: "agent.tool.completed",
      targetType: "agent_tool_call",
      targetId: agentRunId,
      metadata: { toolName },
    });

    return { ok: true, data };
  } catch (error) {
    await source.addAuditLog({
      actorUserId: run.initiatedBy ?? undefined,
      actorAgentId: run.agentId ?? undefined,
      roomId: run.roomId,
      action: "agent.tool.failed",
      targetType: "agent_tool_call",
      targetId: agentRunId,
      metadata: { toolName, error: error instanceof Error ? error.message : String(error) },
    });
    return { ok: false, error: error instanceof Error ? error.message : "tool_failed" };
  }
}

async function runTool(run: AgentRun, toolName: string, input: Record<string, unknown>) {
  const source = shouldUseMockData() ? mockStore : supabaseStore;
  const userId = requireInitiator(run);

  if (toolName === "read_room_summary") {
    const roomId = await resolveReadableRoom(run, userId, input.room_id);
    return source.getMemory(roomId);
  }

  if (toolName === "write_room_summary") {
    const roomId = await resolveWritableRoom(run, userId, input.room_id);
    return source.addMemoryReview({
      roomId,
      agentRunId: run.id,
      proposedMemory: {
        type: "summary_update",
        summary: requireText(input.summary, "summary"),
        reason: requireText(input.reason, "reason"),
      },
    });
  }

  if (toolName === "search_room_messages") {
    const roomId = await resolveReadableRoom(run, userId, input.room_id);
    const query = optionalText(input.query).toLowerCase();
    const limit = boundedLimit(input.limit, 10, 50);
    const messages = (await source.listMessages(roomId))
      .filter((message) => !query || message.content.toLowerCase().includes(query))
      .slice(-limit)
      .map(compactMessage);
    return { roomId, count: messages.length, messages };
  }

  if (toolName === "list_room_files") {
    const roomId = await resolveReadableRoom(run, userId, input.room_id);
    const limit = boundedLimit(input.limit, 20, 50);
    const files = (await source.listFiles(roomId)).slice(-limit).map((file) => ({
      id: file.id,
      originalName: file.originalName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      createdAt: file.createdAt,
      accessLevel: file.accessLevel,
      mountPath: agentFileMountPath(roomId, file),
    }));
    return { roomId, count: files.length, files };
  }

  if (toolName === "read_room_file") {
    const roomId = await resolveReadableRoom(run, userId, input.room_id);
    return readRoomFileForAgent({
      userId,
      roomId,
      fileId: optionalText(input.file_id) || undefined,
      filename: optionalText(input.filename) || undefined,
      maxChars: boundedLimit(input.max_chars, 16000, 30000),
    });
  }

  if (toolName === "create_decision") {
    const roomId = await resolveWritableRoom(run, userId, input.room_id);
    return source.createDecision({
      roomId,
      sourceMessageId: optionalText(input.source_message_id) || run.inputMessageId || undefined,
      title: requireText(input.title, "title"),
      description: optionalText(input.description) || undefined,
      decidedBy: userId,
    });
  }

  if (toolName === "share_item_to_meeting") {
    const sourceRoomId = await resolveWritableRoom(run, userId, input.source_room_id);
    return shareMessageToMeeting({
      userId,
      sourceRoomId,
      sourceMessageId: optionalText(input.source_message_id) || undefined,
      sourceFileId: optionalText(input.source_file_id) || undefined,
      title: requireText(input.title, "title"),
      summary: requireText(input.summary, "summary"),
    });
  }

  if (toolName === "import_meeting_item_to_room") {
    const targetRoomId = await resolveWritableRoom(run, userId, input.target_room_id);
    return importMeetingMessageToRoom({
      userId,
      targetRoomId,
      sharedItemId: optionalText(input.shared_item_id) || undefined,
      sourceMessageId: optionalText(input.source_message_id) || undefined,
      sourceFileId: optionalText(input.source_file_id) || undefined,
      summary: optionalText(input.summary) || undefined,
    });
  }

  if (toolName === "create_task_from_decision") {
    const roomId = await resolveWritableRoom(run, userId, input.room_id);
    const assigneeRoomId = optionalText(input.assignee_room_id);
    if (assigneeRoomId) {
      await resolveReadableRoom(run, userId, assigneeRoomId);
    }
    return source.createTask({
      roomId,
      decisionId: optionalText(input.decision_id) || undefined,
      title: requireText(input.title, "title"),
      description: optionalText(input.description) || undefined,
      assigneeRoomId: assigneeRoomId || undefined,
      dueAt: optionalText(input.due_at) || undefined,
      createdBy: userId,
    });
  }

  if (toolName === "propose_memory_write") {
    const roomId = await resolveWritableRoom(run, userId, input.room_id);
    return source.addMemoryReview({
      roomId,
      agentRunId: run.id,
      proposedMemory: requireObject(input.proposed_memory, "proposed_memory"),
    });
  }

  throw new Error(`Unsupported tool: ${toolName}`);
}

function requireInitiator(run: AgentRun) {
  if (!run.initiatedBy) {
    throw new Error("agent_run_missing_initiator");
  }
  return run.initiatedBy;
}

async function resolveReadableRoom(run: AgentRun, userId: string, rawRoomId: unknown) {
  const roomId = normalizeRoomId(rawRoomId) || defaultToolRoom(run);
  await ensureRoomReadableInAgentScope(run, roomId);
  await requireRoomMember(userId, roomId);
  return roomId;
}

async function resolveWritableRoom(run: AgentRun, userId: string, rawRoomId: unknown) {
  const roomId = normalizeRoomId(rawRoomId) || defaultToolRoom(run);
  ensureRoomInAgentScope(run, roomId);
  await requireRoomMember(userId, roomId);
  return roomId;
}

function defaultToolRoom(run: AgentRun) {
  return run.mode === "meeting_guest" && run.guestSourceRoomId ? run.guestSourceRoomId : run.roomId;
}

function ensureRoomInAgentScope(run: AgentRun, roomId: string) {
  const allowed = new Set([run.roomId]);
  if (run.mode === "meeting_guest" && run.guestSourceRoomId) {
    allowed.add(run.guestSourceRoomId);
  }
  if (!allowed.has(roomId)) {
    throw new Error(`tool_room_out_of_scope:${roomId}`);
  }
}

async function ensureRoomReadableInAgentScope(run: AgentRun, roomId: string) {
  const source = shouldUseMockData() ? mockStore : supabaseStore;
  const agent = run.agentId ? await source.getAgent(run.agentId) : null;
  if (hasAllRoomSearchAccess(agent)) {
    return;
  }
  ensureRoomInAgentScope(run, roomId);
}

function normalizeRoomId(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function requireText(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`missing_${field}`);
  }
  return value.trim();
}

function optionalText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function requireObject(value: unknown, field: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`missing_${field}`);
  }
  return value as Record<string, unknown>;
}

function boundedLimit(value: unknown, fallback: number, max: number) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric < 1) {
    return fallback;
  }
  return Math.min(Math.floor(numeric), max);
}

function compactMessage(message: RoomMessage) {
  return {
    id: message.id,
    type: message.type,
    senderUserId: message.senderUserId,
    senderAgentId: message.senderAgentId,
    agentRunId: message.agentRunId,
    threadId: message.threadId,
    content: message.content.length > 1200 ? `${message.content.slice(0, 1200)}...` : message.content,
    createdAt: message.createdAt,
  };
}
