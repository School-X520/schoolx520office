import { beforeEach, describe, expect, it, vi } from "vitest";

// 성능 게이트(계획 Phase 3 DoD): 실 모드에서 페이지 데이터 조회가 RPC 1왕복으로 끝나는지 계측한다.
// admin 클라이언트를 스파이로 대체하고, .from(테이블 조회)이 한 번도 호출되지 않음(=직접 쿼리 0)을 단언한다.

let admin: { rpc: ReturnType<typeof vi.fn>; from: ReturnType<typeof vi.fn> };

vi.mock("@/lib/env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/env")>()),
  shouldUseMockData: () => false,
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => admin,
}));

import { getOfficeDashboard, getRoomView } from "@/server/rooms/get-room-view";
import { getOperationStatus } from "@/server/office/operation-status-service";

const ISO = "2026-01-01T00:00:00+00:00";

const roomViewPayload = {
  room: {
    id: "finance",
    name: "재무",
    type: "department",
    icon: "💰",
    description: "",
    display_order: 1,
    layout_x: 0,
    layout_y: 0,
    is_active: true,
    created_at: ISO,
  },
  membership: { user_id: "u1", room_id: "finance", role: "member", joined_at: ISO },
  threadNotFound: false,
  userMemberships: [{ user_id: "u1", room_id: "finance", role: "member", joined_at: ISO }],
  rooms: [],
  agents: [],
  residentAgent: null,
  memory: null,
  activeThread: { id: "11111111-1111-4111-8111-111111111111", room_id: "finance", status: "active", created_at: ISO, last_message_at: ISO, updated_at: ISO, metadata: {} },
  threads: [],
  messages: [],
  profiles: [],
  files: [],
  sharedItems: [],
  imports: [],
  decisions: [],
  tasks: [],
  videoMeetings: [],
};

const officePayload = {
  rooms: [],
  memberships: [],
  agents: [],
  sharedItems: [],
  videoMeetings: [],
  opsCounts: { sharedCount: 0, briefingCount: 0, taskCount: 0 },
};

beforeEach(() => {
  admin = {
    rpc: vi.fn(async (fn: string) => {
      if (fn === "rpc_room_view") return { data: roomViewPayload, error: null };
      if (fn === "rpc_office_view") return { data: officePayload, error: null };
      if (fn === "rpc_ops_counts") return { data: { sharedCount: 0, briefingCount: 0, taskCount: 0 }, error: null };
      return { data: null, error: null };
    }),
    from: vi.fn(() => {
      throw new Error("직접 테이블 조회(.from)는 RPC 경로에서 허용되지 않습니다");
    }),
  };
});

describe("real-mode page views issue exactly one RPC round-trip", () => {
  it("getRoomView → 1 rpc_room_view, 0 table reads", async () => {
    const view = await getRoomView("u1", "finance");
    expect(view).not.toBeNull();
    expect(admin.rpc).toHaveBeenCalledTimes(1);
    expect(admin.rpc).toHaveBeenCalledWith("rpc_room_view", expect.objectContaining({ p_room_id: "finance" }));
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("getOfficeDashboard → 1 rpc_office_view, 0 table reads", async () => {
    const dashboard = await getOfficeDashboard("u1");
    expect(dashboard.rooms).toEqual([]);
    expect(admin.rpc).toHaveBeenCalledTimes(1);
    expect(admin.rpc).toHaveBeenCalledWith("rpc_office_view", expect.objectContaining({ p_user_id: "u1" }));
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("getOperationStatus → 1 rpc_ops_counts, 0 table reads", async () => {
    await getOperationStatus("u1");
    expect(admin.rpc).toHaveBeenCalledTimes(1);
    expect(admin.rpc).toHaveBeenCalledWith("rpc_ops_counts", expect.objectContaining({ p_user_id: "u1" }));
    expect(admin.from).not.toHaveBeenCalled();
  });
});
