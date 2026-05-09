import "server-only";

import { shouldUseMockData } from "@/lib/env";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";
import { requireRoomMember } from "@/server/auth/require-room-member";

export async function getOfficeView(userId: string) {
  const source = shouldUseMockData() ? mockStore : supabaseStore;
  const rooms = await source.listRooms();
  const memberships = shouldUseMockData()
    ? mockStore.listMemberships().filter((item) => item.userId === userId)
    : await supabaseStore.listMemberships(userId);
  const agents = await source.listAgents();
  const messagesByRoom = Object.fromEntries(
    await Promise.all(
      rooms.map(async (room) => [room.id, (await source.listMessages(room.id)).length] as const),
    ),
  );
  return { rooms, memberships, agents, messagesByRoom };
}

export async function getRoomView(userId: string, roomId: string) {
  const source = shouldUseMockData() ? mockStore : supabaseStore;
  const room = await source.getRoom(roomId);
  if (!room) {
    return null;
  }

  const membership = await requireRoomMember(userId, roomId);
  const activeMeeting =
    (await source
      .listVideoMeetings(roomId))
      .find((meeting) => meeting.status === "live" || meeting.status === "scheduled") ?? null;

  return {
    room,
    agent: (await source.getAgentByRoom(roomId)) ?? undefined,
    membership,
    memory: (await source.getMemory(roomId))!,
    messages: await source.listMessages(roomId),
    files: await source.listFiles(roomId),
    sharedItems: await source.listSharedItems(roomId),
    imports: await source.listImports(roomId),
    decisions: await source.listDecisions(roomId),
    tasks: await source.listTasks(roomId),
    activeMeeting,
  };
}
