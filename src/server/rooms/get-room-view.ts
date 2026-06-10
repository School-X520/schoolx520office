import "server-only";

import { shouldUseMockData } from "@/lib/env";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";
import { canWriteRoom, requireRoomMember } from "@/server/auth/require-room-member";
import { resolveRoomThread } from "@/server/rooms/thread-service";
import {
  DEVELOPMENT_AGENT_ROOM_ID,
  getCoordinatorAgent,
  isDevelopmentAgent,
} from "@/lib/agents/development-agent";
import { backfillDevelopmentAgentRequestMirrors } from "@/server/agents/development-request-mirror";
import { isActiveVideoMeeting } from "@/lib/video-meetings/active";

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
  if (!room || !room.isActive) {
    return null;
  }

  if (roomId === DEVELOPMENT_AGENT_ROOM_ID) {
    await backfillDevelopmentAgentRequestMirrors({ source });
  }

  const userMemberships = shouldUseMockData()
    ? mockStore.listMemberships().filter((item) => item.userId === userId)
    : await supabaseStore.listMemberships(userId);
  const writableRoomIds = new Set(userMemberships.filter((item) => canWriteRoom(item.role)).map((item) => item.roomId));
  const [threads, activeThread] = await Promise.all([
    source.listThreads(roomId),
    resolveRoomThread(userId, roomId, options.threadId),
  ]);
  const [
    allRooms,
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
    roomMemberships,
    profiles,
  ] = await Promise.all([
    source.listRooms(),
    source.getAgentByRoom(roomId),
    source.listAgents(),
    source.listVideoMeetings(roomId),
    source.getMemory(roomId),
    source.listMessages(roomId, activeThread.id),
    source.listFiles(roomId),
    source.listSharedItems(roomId),
    source.listImports(roomId),
    source.listDecisions("meeting"),
    source.listTasks(roomId),
    source.listMemberships(),
    source.listUserProfiles(),
  ]);
  const visibleUserIds = new Set(
    roomMemberships.filter((item) => item.roomId === roomId).map((item) => item.userId),
  );
  messages.forEach((message) => {
    if (message.senderUserId) {
      visibleUserIds.add(message.senderUserId);
    }
  });
  const memberProfiles = profiles.filter((profile) => visibleUserIds.has(profile.userId));
  const developmentAgent = agents.find(isDevelopmentAgent);
  const coordinatorAgent = getCoordinatorAgent();
  const guestAgents =
    roomId === "meeting"
      ? [coordinatorAgent, ...agents.filter((agent) => writableRoomIds.has(agent.roomId) || isDevelopmentAgent(agent))]
      : developmentAgent && developmentAgent.id !== residentAgent?.id
        ? [developmentAgent]
        : [];
  const activeMeeting = videoMeetings.find((meeting) => isActiveVideoMeeting(meeting)) ?? null;
  const roomNameById = new Map(allRooms.map((item) => [item.id, item.name]));
  const sharedItemsWithRoomNames = sharedItems.map((item) => ({
    ...item,
    sourceRoomName: roomNameById.get(item.sourceRoomId) ?? item.sourceRoomName ?? null,
    targetRoomName: roomNameById.get(item.targetRoomId) ?? item.targetRoomName ?? null,
  }));
  const taskTargetRooms = allRooms.filter(
    (item) => item.id !== "meeting" && item.isActive && writableRoomIds.has(item.id),
  );

  return {
    room,
    agent: residentAgent ?? undefined,
    guestAgents,
    taskTargetRooms,
    membership,
    memory: memory!,
    threads: threads.length ? threads : [activeThread],
    activeThread,
    messages,
    memberProfiles,
    files,
    sharedItems: sharedItemsWithRoomNames,
    imports,
    decisions,
    tasks,
    activeMeeting,
  };
}
