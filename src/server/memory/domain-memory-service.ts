import "server-only";

import { shouldUseMockData } from "@/lib/env";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";
import { requireRoomMember } from "@/server/auth/require-room-member";
import type { DomainMemory } from "@/types/domain";
import type { AgentMemoryAttachment } from "@/server/agents/types";

export function mergeMemoryPatch(memory: DomainMemory, patch: Partial<DomainMemory>) {
  return {
    ...memory,
    ...patch,
    activeTasks: patch.activeTasks ?? memory.activeTasks,
    decisions: patch.decisions ?? memory.decisions,
    keyFacts: patch.keyFacts ?? memory.keyFacts,
    pendingContext: patch.pendingContext ?? memory.pendingContext,
    processedContext: patch.processedContext ?? memory.processedContext,
  };
}

export async function getRoomMemory(roomId: string) {
  return shouldUseMockData() ? mockStore.getMemory(roomId) : supabaseStore.getMemory(roomId);
}

export async function getAgentStartupContext(
  roomId: string,
  mode: string,
  options: { messageLimit?: number; threadId?: string | null } = {},
) {
  const source = shouldUseMockData() ? mockStore : supabaseStore;
  const [room, memory, thread, messages, agents] = await Promise.all([
    source.getRoom(roomId),
    source.getMemory(roomId),
    options.threadId ? source.getThread(options.threadId) : source.ensureRoomThread(roomId),
    source.listMessages(roomId, options.threadId),
    source.listAgents(),
  ]);
  const messageLimit = options.messageLimit ?? 40;
  const recentMessages = messageLimit > 0 ? messages.slice(-messageLimit) : [];
  return {
    room,
    mode,
    thread,
    memory,
    messageCount: messages.length,
    recentMessages,
    agents: agents.map((agent) => ({
      id: agent.id,
      roomId: agent.roomId,
      name: agent.name,
      role: agent.role,
    })),
  };
}

export async function getProjectObserverContext(
  userId: string,
  options: { currentRoomId: string; currentThreadId?: string | null; messageLimitPerRoom?: number },
) {
  const source = shouldUseMockData() ? mockStore : supabaseStore;
  const rooms = await source.listRooms();
  const readableRooms = [];

  for (const room of rooms) {
    try {
      await requireRoomMember(userId, room.id);
      readableRooms.push(room);
    } catch {
      // Development bot observation follows the initiating user's room memberships.
    }
  }

  const messageLimit = options.messageLimitPerRoom ?? 4;
  const roomContexts = await Promise.all(
    readableRooms.map(async (room) => {
      const [memory, threads, messages, decisions, tasks] = await Promise.all([
        source.getMemory(room.id),
        source.listThreads(room.id),
        source.listMessages(room.id),
        source.listDecisions("meeting"),
        source.listTasks(room.id),
      ]);
      const activeThread = threads.find((thread) => thread.status === "active") ?? threads[0] ?? null;
      return {
        room: {
          id: room.id,
          name: room.name,
          type: room.type,
          description: room.description,
        },
        memorySummary: memory?.summary ?? "",
        activeTaskCount: tasks.filter((task) => task.status !== "done").length,
        decisionCount: decisions.length,
        threadCount: threads.length,
        latestThread: activeThread
          ? {
              id: activeThread.id,
              title: activeThread.title,
              summary: activeThread.summary,
              carryoverSummary: activeThread.carryoverSummary,
              lastMessageAt: activeThread.lastMessageAt,
            }
          : null,
        recentMessages: messages.slice(-messageLimit).map((message) => ({
          id: message.id,
          threadId: message.threadId,
          type: message.type,
          senderUserId: message.senderUserId,
          senderAgentId: message.senderAgentId,
          content: message.content.length > 700 ? `${message.content.slice(0, 700)}...` : message.content,
          createdAt: message.createdAt,
        })),
      };
    }),
  );

  return {
    currentRoomId: options.currentRoomId,
    currentThreadId: options.currentThreadId ?? null,
    readableRoomCount: roomContexts.length,
    rooms: roomContexts,
  };
}

export async function getAgentMemoryAttachments(
  roomId: string,
  accessMode: AgentMemoryAttachment["accessMode"] = "read_only",
) {
  const source = shouldUseMockData() ? mockStore : supabaseStore;
  const stores = await source.listRoomMemoryStores(roomId);
  return stores
    .filter((store) => Boolean(store.anthropicMemoryStoreId))
    .map((store) => ({
      roomId: store.roomId,
      memoryStoreId: store.anthropicMemoryStoreId,
      accessMode,
      purpose: store.purpose || "School-X room long-term memory. Check before starting any task.",
    }));
}

export async function appendPendingContext(roomId: string, context: Record<string, unknown>) {
  return shouldUseMockData()
    ? mockStore.appendPendingContext(roomId, context)
    : supabaseStore.appendPendingContext(roomId, context);
}

export async function markPendingContextProcessed(roomId: string, contextIds: string[]) {
  return shouldUseMockData()
    ? mockStore.markPendingProcessed(roomId, contextIds)
    : supabaseStore.markPendingProcessed(roomId, contextIds);
}

export async function updateRoomMemory(roomId: string, patch: Partial<DomainMemory>, agentRunId?: string) {
  const source = shouldUseMockData() ? mockStore : supabaseStore;
  const current = await source.getMemory(roomId);
  if (!current) {
    return null;
  }
  const next = mergeMemoryPatch(current, { ...patch, updatedByAgentRun: agentRunId ?? null });
  return source.updateMemory(roomId, next);
}

export async function createMemoryHistory() {
  return { status: "mock-recorded" };
}
