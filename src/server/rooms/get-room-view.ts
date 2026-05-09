import "server-only";

import { mockStore } from "@/server/data/mock-store";
import { requireRoomMember } from "@/server/auth/require-room-member";

export async function getOfficeView(userId: string) {
  const rooms = mockStore.listRooms();
  const memberships = mockStore.listMemberships().filter((item) => item.userId === userId);
  const agents = mockStore.listAgents();
  const messagesByRoom = Object.fromEntries(
    rooms.map((room) => [room.id, mockStore.listMessages(room.id).length]),
  );
  return { rooms, memberships, agents, messagesByRoom };
}

export async function getRoomView(userId: string, roomId: string) {
  const room = mockStore.getRoom(roomId);
  if (!room) {
    return null;
  }

  const membership = await requireRoomMember(userId, roomId);
  const activeMeeting =
    mockStore
      .listVideoMeetings(roomId)
      .find((meeting) => meeting.status === "live" || meeting.status === "scheduled") ?? null;

  return {
    room,
    agent: mockStore.getAgentByRoom(roomId) ?? undefined,
    membership,
    memory: mockStore.getMemory(roomId)!,
    messages: mockStore.listMessages(roomId),
    files: mockStore.listFiles(roomId),
    sharedItems: mockStore.listSharedItems(roomId),
    imports: mockStore.listImports(roomId),
    decisions: mockStore.listDecisions(roomId),
    tasks: mockStore.listTasks(roomId),
    activeMeeting,
  };
}
