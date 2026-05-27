import "server-only";

import { shouldUseMockData } from "@/lib/env";
import { requireRoomMember } from "@/server/auth/require-room-member";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";
import type { Decision, DomainMemory, RoomThread, Task } from "@/types/domain";

type Source = typeof mockStore | typeof supabaseStore;

function getSource(): Source {
  return shouldUseMockData() ? mockStore : supabaseStore;
}

export async function listRoomThreads(userId: string, roomId: string) {
  await requireRoomMember(userId, roomId);
  const source = getSource();
  const threads = await source.listThreads(roomId);
  return threads.length ? threads : [await source.ensureRoomThread(roomId)];
}

export async function resolveRoomThread(userId: string, roomId: string, threadId?: string | null) {
  await requireRoomMember(userId, roomId);
  const source = getSource();
  if (threadId) {
    const thread = await source.getThread(threadId);
    if (thread?.roomId === roomId) {
      return thread;
    }
    const error = new Error("대화 스레드를 찾을 수 없습니다.") as Error & { status: number };
    error.status = 404;
    throw error;
  }

  const threads = await source.listThreads(roomId);
  return threads.find((thread) => thread.status === "active") ?? threads[0] ?? source.ensureRoomThread(roomId);
}

export async function createRoomThread(userId: string, roomId: string, title?: string | null) {
  await requireRoomMember(userId, roomId);
  const source = getSource();
  const [room, threads, memory, decisions, tasks] = await Promise.all([
    source.getRoom(roomId),
    source.listThreads(roomId),
    source.getMemory(roomId),
    source.listDecisions("meeting"),
    source.listTasks(roomId),
  ]);
  if (!room) {
    const error = new Error("방을 찾을 수 없습니다.") as Error & { status: number };
    error.status = 404;
    throw error;
  }

  const previousThread = threads.find((thread) => thread.status === "active") ?? threads[0] ?? null;
  const carryoverSummary = buildCarryoverSummary({
    memory,
    previousThread,
    decisions,
    tasks,
  });
  const thread = await source.createThread({
    roomId,
    title: title?.trim() || `새 대화 ${threads.length + 1}`,
    summary: "",
    carryoverSummary,
    status: "active",
    createdBy: userId,
    metadata: {
      carryoverPolicy: "automatic_summary",
      previousThreadId: previousThread?.id ?? null,
    },
  });

  await source.addAuditLog({
    actorUserId: userId,
    roomId,
    action: "room_thread.created",
    targetType: "room_thread",
    targetId: thread.id,
    metadata: { previousThreadId: previousThread?.id ?? null },
  });

  return thread;
}

export async function updateRoomThread(
  userId: string,
  roomId: string,
  threadId: string,
  patch: Pick<Partial<RoomThread>, "title" | "summary" | "carryoverSummary" | "status">,
) {
  await requireRoomMember(userId, roomId);
  const source = getSource();
  const thread = await source.getThread(threadId);
  if (thread?.roomId !== roomId) {
    const error = new Error("대화 스레드를 찾을 수 없습니다.") as Error & { status: number };
    error.status = 404;
    throw error;
  }

  const updated = await source.updateThread(threadId, {
    title: patch.title?.trim() || undefined,
    summary: patch.summary,
    carryoverSummary: patch.carryoverSummary,
    status: patch.status,
  });

  await source.addAuditLog({
    actorUserId: userId,
    roomId,
    action: "room_thread.updated",
    targetType: "room_thread",
    targetId: threadId,
  });

  return updated;
}

export function buildCarryoverSummary(input: {
  memory: DomainMemory | null;
  previousThread?: RoomThread | null;
  decisions: Decision[];
  tasks: Task[];
}) {
  const activeTasks = input.tasks.filter((task) => task.status === "todo" || task.status === "doing").slice(0, 6);
  const decisions = input.decisions.slice(0, 6);
  const sections = [
    input.memory?.summary ? `방 장기 요약: ${input.memory.summary}` : null,
    input.previousThread?.summary ? `이전 대화 요약: ${input.previousThread.summary}` : null,
    decisions.length ? `최근 결정: ${decisions.map((decision) => decision.title).join("; ")}` : null,
    activeTasks.length ? `미해결 할 일: ${activeTasks.map((task) => task.title).join("; ")}` : null,
  ].filter((section): section is string => Boolean(section));

  return sections.join("\n").slice(0, 4000);
}
