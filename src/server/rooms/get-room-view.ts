import "server-only";

import { shouldUseMockData } from "@/lib/env";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";
import { canWriteRoom, requireRoomMember } from "@/server/auth/require-room-member";
import { resolveRoomThread } from "@/server/rooms/thread-service";

export async function getOfficeView(userId: string) {
  const source = shouldUseMockData() ? mockStore : supabaseStore;
  const [rooms, memberships, agents] = await Promise.all([
    source.listRooms(),
    shouldUseMockData()
      ? Promise.resolve(mockStore.listMemberships().filter((item) => item.userId === userId))
      : supabaseStore.listMemberships(userId),
    source.listAgents(),
  ]);
  return { rooms, memberships, agents };
}

export async function getRoomView(userId: string, roomId: string, options: { threadId?: string | null } = {}) {
  const source = shouldUseMockData() ? mockStore : supabaseStore;
  const [room, membership] = await Promise.all([source.getRoom(roomId), requireRoomMember(userId, roomId)]);
  if (!room) {
    return null;
  }

  const userMemberships =
    roomId === "meeting"
      ? shouldUseMockData()
        ? mockStore.listMemberships().filter((item) => item.userId === userId)
        : await supabaseStore.listMemberships(userId)
      : [];
  const writableRoomIds = new Set(userMemberships.filter((item) => canWriteRoom(item.role)).map((item) => item.roomId));
  const [threads, activeThread] = await Promise.all([
    source.listThreads(roomId),
    resolveRoomThread(userId, roomId, options.threadId),
  ]);
  const [
    residentAgent,
    agents,
    videoMeetings,
    memory,
    messages,
    files,
    sharedItems,
    imports,
    decisions,
    tasks,
  ] = await Promise.all([
    source.getAgentByRoom(roomId),
    roomId === "meeting" ? source.listAgents() : Promise.resolve([]),
    source.listVideoMeetings(roomId),
    source.getMemory(roomId),
    source.listMessages(roomId, activeThread.id),
    source.listFiles(roomId),
    source.listSharedItems(roomId),
    source.listImports(roomId),
    source.listDecisions(roomId),
    source.listTasks(roomId),
  ]);
  const guestAgents = roomId === "meeting" ? agents.filter((agent) => writableRoomIds.has(agent.roomId)) : [];
  const activeMeeting = videoMeetings.find((meeting) => meeting.status === "live" || meeting.status === "scheduled") ?? null;

  return {
    room,
    agent: residentAgent ?? undefined,
    guestAgents,
    membership,
    memory: memory!,
    threads: threads.length ? threads : [activeThread],
    activeThread,
    messages,
    files,
    sharedItems,
    imports,
    decisions,
    tasks,
    activeMeeting,
  };
}
