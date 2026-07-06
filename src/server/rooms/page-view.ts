import "server-only";

// Phase 3 (v2 리빌드 계획) — "페이지당 1왕복" 읽기 경로.
// getRoomView/getOfficeDashboard의 실(supabase) 모드가 이 모듈을 통해 RPC를 1회 호출하고,
// 반환된 원시 행(jsonb)을 supabase-store의 기존 *From 매퍼로 도메인 뷰모델에 매핑한다.
// mock 모드는 get-room-view.ts의 기존 조립 경로를 그대로 쓴다(이 모듈 미사용).

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { statusError } from "@/lib/http-error";
import { ForbiddenError } from "@/server/auth/errors";
import { canWriteRoom } from "@/server/auth/require-room-member";
import { getCoordinatorAgent, isDevelopmentAgent } from "@/lib/agents/development-agent";
import { isActiveVideoMeeting } from "@/lib/video-meetings/active";
import { ROOM_MESSAGE_FETCH_LIMIT } from "@/server/data/data-store";
import {
  agentFrom,
  decisionFrom,
  fileFrom,
  importFrom,
  membershipFrom,
  memoryFrom,
  messageFrom,
  roomFrom,
  sharedItemFrom,
  taskFrom,
  threadFrom,
  userProfileFrom,
  videoMeetingFrom,
} from "@/server/data/supabase-store";
import type {
  Agent,
  DomainMemory,
  MessageType,
  OperationStatusSnapshot,
  Room,
  RoomMembership,
  RoomMessage,
  RoomViewModel,
  SharedItem,
  VideoMeeting,
} from "@/types/domain";

export type OfficeDashboard = {
  rooms: Room[];
  memberships: RoomMembership[];
  agents: Agent[];
  sharedItems: SharedItem[];
  activeMeeting: VideoMeeting | null;
  operationStatus: OperationStatusSnapshot;
};

type Row = Record<string, unknown>;

function asRows(value: unknown): Row[] {
  return Array.isArray(value) ? (value as Row[]) : [];
}

function asRow(value: unknown): Row | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : null;
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

// PostgREST의 uuid 파라미터는 유효한 uuid만 허용한다. 레거시 합성 스레드 id 등
// uuid가 아닌 값은 null로 넘겨 RPC가 활성 스레드를 선택하게 한다.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function asUuidOrNull(value?: string | null): string | null {
  return value && UUID_RE.test(value) ? value : null;
}

type LooseRpc = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

async function callRpc(fn: string, args: Record<string, unknown>): Promise<unknown> {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    throw statusError("데이터베이스 연결이 구성되지 않았습니다.", 503);
  }
  const { data, error } = await (admin as unknown as LooseRpc).rpc(fn, args);
  if (error) {
    throw statusError(`데이터 조회에 실패했습니다: ${error.message}`, 500);
  }
  return data;
}

// ── 방 뷰 ────────────────────────────────────────────────────────

// rpc_room_view 페이로드를 RoomViewModel로 조립한다(순수 함수, 테스트 대상).
// 호출부(fetchRoomViewViaRpc)가 membership/room/threadNotFound 가드를 마친 "성공" 페이로드를 넘긴다.
export function assembleRoomView(payload: Row, userId: string, roomId: string): RoomViewModel {
  void userId;
  const room = roomFrom(asRow(payload.room) ?? {});
  const membershipRow = asRow(payload.membership);
  const membership = membershipRow ? membershipFrom(membershipRow) : undefined;

  const userMemberships = asRows(payload.userMemberships).map(membershipFrom);
  const writableRoomIds = new Set(
    userMemberships.filter((item) => canWriteRoom(item.role)).map((item) => item.roomId),
  );

  const agents = asRows(payload.agents).map(agentFrom);
  const residentRow = asRow(payload.residentAgent);
  const residentAgent = residentRow ? agentFrom(residentRow) : undefined;
  const developmentAgent = agents.find(isDevelopmentAgent);
  const coordinatorAgent = getCoordinatorAgent();
  const guestAgents =
    roomId === "meeting"
      ? [coordinatorAgent, ...agents.filter((agent) => writableRoomIds.has(agent.roomId) || isDevelopmentAgent(agent))]
      : developmentAgent && developmentAgent.id !== residentAgent?.id
        ? [developmentAgent]
        : [];

  const allRooms = asRows(payload.rooms).map(roomFrom);
  const roomNameById = new Map(allRooms.map((item) => [item.id, item.name]));
  const sharedItems = asRows(payload.sharedItems)
    .map(sharedItemFrom)
    .map((item) => ({
      ...item,
      sourceRoomName: roomNameById.get(item.sourceRoomId) ?? item.sourceRoomName ?? null,
      targetRoomName: roomNameById.get(item.targetRoomId) ?? item.targetRoomName ?? null,
    }));
  const taskTargetRooms = allRooms.filter(
    (item) => item.id !== "meeting" && item.isActive && writableRoomIds.has(item.id),
  );

  const activeThread = threadFrom(asRow(payload.activeThread) ?? {});
  const threadRows = asRows(payload.threads);
  const threads = threadRows.length ? threadRows.map(threadFrom) : [activeThread];

  const memoryRow = asRow(payload.memory);
  const memory: DomainMemory = memoryRow
    ? memoryFrom(memoryRow)
    : {
        roomId,
        summary: "",
        activeTasks: [],
        decisions: [],
        keyFacts: [],
        pendingContext: [],
        processedContext: [],
        metadata: {},
        updatedAt: new Date().toISOString(),
        updatedByAgentRun: null,
      };

  const videoMeetings = asRows(payload.videoMeetings).map(videoMeetingFrom);
  const activeMeeting = videoMeetings.find((meeting) => isActiveVideoMeeting(meeting)) ?? null;

  return {
    room,
    agent: residentAgent ?? undefined,
    guestAgents,
    taskTargetRooms,
    membership,
    memory,
    threads,
    activeThread,
    messages: asRows(payload.messages).map(messageFrom),
    memberProfiles: asRows(payload.profiles).map(userProfileFrom),
    files: asRows(payload.files).map(fileFrom),
    sharedItems,
    imports: asRows(payload.imports).map(importFrom),
    decisions: asRows(payload.decisions).map(decisionFrom),
    tasks: asRows(payload.tasks).map(taskFrom),
    activeMeeting,
  };
}

// 실 모드 방 뷰: RPC 1회. 비멤버 → ForbiddenError, 방 없음/비활성 → null(notFound), 잘못된 스레드 → 404.
export async function fetchRoomViewViaRpc(
  userId: string,
  roomId: string,
  threadId?: string | null,
): Promise<RoomViewModel | null> {
  const data = await callRpc("rpc_room_view", {
    p_user_id: userId,
    p_room_id: roomId,
    p_thread_id: asUuidOrNull(threadId),
    p_msg_limit: ROOM_MESSAGE_FETCH_LIMIT,
  });
  const payload = asRow(data);
  if (!payload) {
    return null;
  }

  // 순서 주의: v1 getRoomView는 requireRoomMember(→Forbidden)를 방 활성 검사보다 먼저 던진다.
  if (!asRow(payload.membership)) {
    throw new ForbiddenError("이 방에 접근할 권한이 없습니다.");
  }
  const roomRow = asRow(payload.room);
  const room = roomRow ? roomFrom(roomRow) : null;
  if (!room || !room.isActive) {
    return null;
  }
  if (payload.threadNotFound === true) {
    throw statusError("대화 스레드를 찾을 수 없습니다.", 404);
  }

  return assembleRoomView(payload, userId, roomId);
}

// ── 오피스 대시보드 ───────────────────────────────────────────────

export function assembleOfficeDashboard(payload: Row): OfficeDashboard {
  const counts = asRow(payload.opsCounts) ?? {};
  const videoMeetings = asRows(payload.videoMeetings).map(videoMeetingFrom);
  const activeMeeting = videoMeetings.find((meeting) => isActiveVideoMeeting(meeting)) ?? null;

  return {
    rooms: asRows(payload.rooms).map(roomFrom),
    memberships: asRows(payload.memberships).map(membershipFrom),
    agents: asRows(payload.agents).map(agentFrom),
    sharedItems: asRows(payload.sharedItems).map(sharedItemFrom),
    activeMeeting,
    operationStatus: {
      sharedCount: asNumber(counts.sharedCount),
      briefingCount: asNumber(counts.briefingCount),
      taskCount: asNumber(counts.taskCount),
      updatedAt: new Date().toISOString(),
    },
  };
}

export async function fetchOfficeDashboardViaRpc(userId: string): Promise<OfficeDashboard> {
  const data = await callRpc("rpc_office_view", { p_user_id: userId });
  return assembleOfficeDashboard(asRow(data) ?? {});
}

// 실 모드 메시지 전송: rpc_send_message 1왕복(멤버십/쓰기검사·스레드해석·insert·bump·감사).
export async function sendMessageViaRpc(input: {
  userId: string;
  roomId: string;
  threadId?: string | null;
  content: string;
  type?: MessageType;
  metadata?: Record<string, unknown>;
}): Promise<RoomMessage> {
  const data = await callRpc("rpc_send_message", {
    p_user_id: input.userId,
    p_room_id: input.roomId,
    p_thread_id: asUuidOrNull(input.threadId),
    p_content: input.content,
    p_type: input.type ?? "human",
    p_metadata: input.metadata ?? {},
  });
  const payload = asRow(data) ?? {};
  if (payload.forbidden === true) {
    throw new ForbiddenError("메시지를 작성할 권한이 없습니다.");
  }
  if (payload.threadNotFound === true) {
    throw statusError("대화 스레드를 찾을 수 없습니다.", 404);
  }
  const messageRow = asRow(payload.message);
  if (!messageRow) {
    throw statusError("메시지 전송에 실패했습니다.", 500);
  }
  return messageFrom(messageRow);
}

// rpc_ops_counts만 필요한 경량 경로(운영 상태 갱신 라우트).
export async function fetchOpsCountsViaRpc(userId: string): Promise<OperationStatusSnapshot> {
  const data = await callRpc("rpc_ops_counts", { p_user_id: userId });
  const counts = asRow(data) ?? {};
  return {
    sharedCount: asNumber(counts.sharedCount),
    briefingCount: asNumber(counts.briefingCount),
    taskCount: asNumber(counts.taskCount),
    updatedAt: new Date().toISOString(),
  };
}
