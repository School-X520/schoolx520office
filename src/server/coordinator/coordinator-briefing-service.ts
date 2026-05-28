import "server-only";

import { shouldUseMockData } from "@/lib/env";
import { requireRoomMember } from "@/server/auth/require-room-member";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";
import type {
  Agent,
  AuditLog,
  CoordinatorBriefing,
  Decision,
  DomainMemory,
  FileRecord,
  JsonObject,
  MeetingImport,
  Room,
  RoomBriefing,
  RoomMessage,
  SharedItem,
  Task,
  UserProfile,
} from "@/types/domain";

type CoordinatorUser = Pick<UserProfile, "userId">;

type CoordinatorSource = {
  listRooms: () => Room[] | Promise<Room[]>;
  getAgentByRoom: (roomId: string) => Agent | null | Promise<Agent | null>;
  getMemory: (roomId: string) => DomainMemory | null | Promise<DomainMemory | null>;
  listMessages: (roomId: string, threadId?: string | null) => RoomMessage[] | Promise<RoomMessage[]>;
  listFiles: (roomId: string) => FileRecord[] | Promise<FileRecord[]>;
  listSharedItems: (roomId?: string) => SharedItem[] | Promise<SharedItem[]>;
  listImports: (roomId?: string) => MeetingImport[] | Promise<MeetingImport[]>;
  listDecisions: (roomId?: string) => Decision[] | Promise<Decision[]>;
  listTasks: (roomId?: string) => Task[] | Promise<Task[]>;
  listRoomBriefings: (roomId?: string, limit?: number) => RoomBriefing[] | Promise<RoomBriefing[]>;
  createRoomBriefing: (
    input: Omit<RoomBriefing, "id" | "createdAt" | "status" | "metadata"> & Partial<RoomBriefing>,
  ) => RoomBriefing | Promise<RoomBriefing>;
  listCoordinatorBriefings: (limit?: number) => CoordinatorBriefing[] | Promise<CoordinatorBriefing[]>;
  createCoordinatorBriefing: (
    input: Omit<CoordinatorBriefing, "id" | "createdAt" | "metadata"> & Partial<CoordinatorBriefing>,
  ) => CoordinatorBriefing | Promise<CoordinatorBriefing>;
  addAuditLog: (
    input: Omit<AuditLog, "id" | "createdAt" | "metadata"> & Partial<AuditLog>,
  ) => AuditLog | Promise<AuditLog>;
};

export type CoordinatorBriefingSnapshot = {
  briefing: CoordinatorBriefing | null;
  roomBriefings: RoomBriefing[];
};

export async function getCoordinatorBriefingSnapshot(user: CoordinatorUser): Promise<CoordinatorBriefingSnapshot> {
  await requireRoomMember(user.userId, "meeting");
  const source = dataSource();
  const rooms = await coordinatorWorkRooms(source);
  const roomIds = new Set(rooms.map((room) => room.id));
  const [briefing] = await source.listCoordinatorBriefings(1);
  const roomBriefings = (await source.listRoomBriefings(undefined, 24))
    .filter((roomBriefing) => roomIds.has(roomBriefing.roomId))
    .slice(0, 12);
  return { briefing: briefing ?? null, roomBriefings };
}

export async function generateCoordinatorBriefing(user: CoordinatorUser): Promise<CoordinatorBriefingSnapshot> {
  await requireRoomMember(user.userId, "meeting");
  const source = dataSource();
  const { periodStart, periodEnd } = seoulDayPeriod();
  const rooms = await coordinatorWorkRooms(source);
  const roomBriefings = await Promise.all(
    rooms.map((room) => createRoomBriefingForRoom(source, room, user.userId, periodStart, periodEnd)),
  );

  const activeTaskCount = sum(roomBriefings, "activeTaskCount");
  const riskCount = roomBriefings.reduce((total, briefing) => total + briefing.risks.length, 0);
  const pendingImportCount = sum(roomBriefings, "pendingImportCount");
  const processedRoomCount = roomBriefings.length;
  const roomById = new Map(rooms.map((room) => [room.id, room]));
  const decisions = await source.listDecisions("meeting");
  const decisionsNeeded = buildDecisionsNeeded(roomBriefings, decisions, roomById);
  const nextActions = roomBriefings
    .flatMap((briefing) =>
      briefing.nextActions.map((action) => ({
        ...action,
        roomId: briefing.roomId,
        roomName: roomById.get(briefing.roomId)?.name ?? briefing.roomId,
      })),
    )
    .slice(0, 8);

  const briefing = await source.createCoordinatorBriefing({
    periodStart,
    periodEnd,
    summary: [
      `${processedRoomCount}개 업무방의 구조화 보고를 수집했습니다.`,
      `활성 할 일 ${activeTaskCount}개, 위험 신호 ${riskCount}개, 반입 대기 ${pendingImportCount}개를 확인했습니다.`,
      "개발봇은 플랫폼 개선 관점, 총괄봇은 운영 PM 관점으로 분리해 종합합니다.",
    ].join(" "),
    roomHighlights: roomBriefings.map((briefing) => ({
      roomId: briefing.roomId,
      roomName: roomById.get(briefing.roomId)?.name ?? briefing.roomId,
      summary: briefing.summary,
      taskCount: numberFrom(briefing.sourceCounts.activeTaskCount),
      riskCount: briefing.risks.length,
      pendingImportCount: numberFrom(briefing.sourceCounts.pendingImportCount),
    })),
    crossRoomRisks: buildCrossRoomRisks(roomBriefings, roomById),
    decisionsNeeded,
    nextActions,
    sourceRoomBriefingIds: roomBriefings.map((briefing) => briefing.id),
    createdBy: user.userId,
    metadata: {
      role: "operations_pm",
      source: "schoolx_structured_room_reports",
      allRoomSearchGranted: true,
      searchedRoomIds: rooms.map((room) => room.id),
    },
  });

  await source.addAuditLog({
    actorUserId: user.userId,
    roomId: "meeting",
    action: "coordinator_briefing.run_logged",
    targetType: "coordinator_briefing",
    targetId: briefing.id,
    metadata: {
      roomBriefingIds: roomBriefings.map((item) => item.id),
      searchedRoomIds: rooms.map((room) => room.id),
      allRoomSearchGranted: true,
    },
  });

  return { briefing, roomBriefings };
}

async function createRoomBriefingForRoom(
  source: CoordinatorSource,
  room: Room,
  userId: string,
  periodStart: string,
  periodEnd: string,
) {
  const [agent, memory, messages, files, sharedItems, imports, tasks] = await Promise.all([
    source.getAgentByRoom(room.id),
    source.getMemory(room.id),
    source.listMessages(room.id),
    source.listFiles(room.id),
    source.listSharedItems(room.id),
    source.listImports(room.id),
    source.listTasks(room.id),
  ]);
  const activeTasks = tasks.filter((task) => task.status !== "done" && task.status !== "cancelled");
  const pendingImports = imports.filter((item) => item.targetRoomId === room.id && item.status === "pending");
  const overdueTasks = activeTasks.filter((task) => task.dueAt && new Date(task.dueAt).getTime() < Date.now());
  const pendingContextCount = memory?.pendingContext.length ?? 0;
  const risks = [
    ...overdueTasks.slice(0, 3).map((task) => ({
      type: "overdue_task",
      title: task.title,
      taskId: task.id,
      dueAt: task.dueAt,
    })),
    ...pendingImports.slice(0, 3).map((item) => ({
      type: "pending_import",
      title: textFrom(item.metadata.title, "반입 항목"),
      meetingImportId: item.id,
      createdAt: item.createdAt,
    })),
    ...(pendingContextCount > 0
      ? [
          {
            type: "pending_context",
            title: `${pendingContextCount}개 pending context 확인 필요`,
            count: pendingContextCount,
          },
        ]
      : []),
  ];
  const nextActions = [
    ...activeTasks.slice(0, 4).map((task) => ({
      type: "task",
      title: task.title,
      taskId: task.id,
      status: task.status,
      dueAt: task.dueAt ?? null,
    })),
    ...(activeTasks.length === 0 && pendingImports.length > 0
      ? [
          {
            type: "review_pending_import",
            title: "회의방에서 가져온 반입 항목 검토",
          },
        ]
      : []),
  ].slice(0, 4);
  const recentMessages = messages.slice(-8);
  const recentHumanOrAgentMessage = recentMessages.findLast((message) => message.type === "human" || message.type === "agent");

  return source.createRoomBriefing({
    roomId: room.id,
    agentId: agent?.id ?? null,
    periodStart,
    periodEnd,
    summary: buildRoomSummary(room, memory, activeTasks, risks, recentHumanOrAgentMessage),
    risks,
    nextActions,
    blockedItems: overdueTasks.slice(0, 3).map((task) => ({
      type: "overdue_task",
      title: task.title,
      taskId: task.id,
      dueAt: task.dueAt,
    })),
    sourceCounts: {
      activeTaskCount: activeTasks.length,
      messageCount: messages.length,
      recentMessageCount: recentMessages.length,
      fileCount: files.length,
      sharedItemCount: sharedItems.length,
      pendingImportCount: pendingImports.length,
      pendingContextCount,
    },
    status: "ready",
    createdBy: userId,
    metadata: {
      roomName: room.name,
      agentName: agent?.name ?? null,
      reportFormat: "structured_room_report_v1",
      recentMessageIds: recentMessages.map((message) => message.id),
    },
  });
}

async function coordinatorWorkRooms(source: CoordinatorSource) {
  const rooms = await source.listRooms();
  return rooms
    .filter((room) => room.type !== "meeting" && room.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

function dataSource(): CoordinatorSource {
  return (shouldUseMockData() ? mockStore : supabaseStore) as CoordinatorSource;
}

function buildRoomSummary(
  room: Room,
  memory: DomainMemory | null,
  activeTasks: Task[],
  risks: JsonObject[],
  recentMessage?: RoomMessage,
) {
  const base = memory?.summary.trim() || recentMessage?.content.trim() || `${room.name} 방의 최근 보고 대상 맥락이 많지 않습니다.`;
  return `${room.name}: ${truncate(base, 120)} 활성 할 일 ${activeTasks.length}개, 위험 신호 ${risks.length}개.`;
}

function buildCrossRoomRisks(roomBriefings: RoomBriefing[], roomById: Map<string, Room>) {
  return roomBriefings
    .flatMap((briefing) =>
      briefing.risks.map((risk) => ({
        ...risk,
        roomId: briefing.roomId,
        roomName: roomById.get(briefing.roomId)?.name ?? briefing.roomId,
      })),
    )
    .slice(0, 8);
}

function buildDecisionsNeeded(roomBriefings: RoomBriefing[], decisions: Decision[], roomById: Map<string, Room>) {
  const blocked = roomBriefings.filter((briefing) => briefing.blockedItems.length > 0);
  const items = blocked.map((briefing) => ({
    type: "blocked_room_followup",
    roomId: briefing.roomId,
    roomName: roomById.get(briefing.roomId)?.name ?? briefing.roomId,
    title: `${roomById.get(briefing.roomId)?.name ?? briefing.roomId} 지연 항목 처리 기준 확인`,
    blockedCount: briefing.blockedItems.length,
  }));
  return items.length
    ? items.slice(0, 5)
    : decisions.slice(0, 3).map((decision) => ({
        type: "recent_decision",
        decisionId: decision.id,
        title: decision.title,
        description: decision.description ?? null,
      }));
}

function seoulDayPeriod(reference = new Date()) {
  const key = seoulDateKey(reference);
  const start = new Date(`${key}T00:00:00+09:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return {
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
  };
}

function seoulDateKey(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}`;
}

function sum(briefings: RoomBriefing[], key: string) {
  return briefings.reduce((total, briefing) => total + numberFrom(briefing.sourceCounts[key]), 0);
}

function numberFrom(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function textFrom(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 3)}...` : value;
}
