import "server-only";

import { mockStore } from "@/server/data/mock-store";
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
  return mockStore.getMemory(roomId);
}

export async function getAgentStartupContext(roomId: string, mode: string) {
  const room = mockStore.getRoom(roomId);
  const memory = mockStore.getMemory(roomId);
  const recentMessages = mockStore.listMessages(roomId).slice(-10);
  return {
    room,
    mode,
    memory,
    recentMessages,
  };
}

export async function appendPendingContext(roomId: string, context: Record<string, unknown>) {
  return mockStore.appendPendingContext(roomId, context);
}

export async function markPendingContextProcessed(roomId: string, contextIds: string[]) {
  return mockStore.markPendingProcessed(roomId, contextIds);
}

export async function updateRoomMemory(roomId: string, patch: Partial<DomainMemory>, agentRunId?: string) {
  const current = mockStore.getMemory(roomId);
  if (!current) {
    return null;
  }
  const next = mergeMemoryPatch(current, { ...patch, updatedByAgentRun: agentRunId ?? null });
  return mockStore.updateMemory(roomId, next);
}

export async function createMemoryHistory() {
  return { status: "mock-recorded" };
}
