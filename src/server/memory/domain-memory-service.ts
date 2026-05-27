import "server-only";

import { shouldUseMockData } from "@/lib/env";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";
import type { DomainMemory } from "@/types/domain";

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

export async function getAgentStartupContext(roomId: string, mode: string, options: { messageLimit?: number } = {}) {
  const source = shouldUseMockData() ? mockStore : supabaseStore;
  const [room, memory, messages, agents] = await Promise.all([
    source.getRoom(roomId),
    source.getMemory(roomId),
    source.listMessages(roomId),
    source.listAgents(),
  ]);
  const messageLimit = options.messageLimit ?? 40;
  const recentMessages = messages.slice(-messageLimit);
  return {
    room,
    mode,
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
