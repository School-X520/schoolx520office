import { beforeAll, describe, expect, it, vi } from "vitest";
import { mockStore } from "@/server/data/mock-store";
import {
  listVisibleMeetingImports,
  listVisibleSharedItems,
} from "@/server/collaboration/share-import-service";

// requireUser는 쿠키/세션을 읽으므로 라우트 핸들러 테스트에서는 mock으로 대체한다.
const { requireUserMock } = vi.hoisted(() => ({ requireUserMock: vi.fn() }));
vi.mock("@/server/auth/require-user", () => ({ requireUser: requireUserMock }));

// 라우트 핸들러는 mock 이후에 import 한다(requireUser mock이 적용된 상태로 로드되도록).
const { GET: sharedItemsGET } = await import("@/app/api/shared-items/route");
const { GET: meetingImportsGET } = await import("@/app/api/meeting-imports/route");
const { GET: decisionsGET } = await import("@/app/api/decisions/route");

// finance 방에만 속한 사용자 / development 방에만 속한 사용자.
// seedMemberships의 mockUser는 전 방 admin이므로, 격리 검증에는 제한된 멤버십 사용자를 쓴다.
const FINANCE_USER = "iso-finance-user";
const DEV_USER = "iso-dev-user";
const MEETING_USER = "iso-meeting-user";

function asUser(userId: string) {
  requireUserMock.mockResolvedValue({ userId });
}

beforeAll(() => {
  mockStore.upsertMembership({ userId: FINANCE_USER, roomId: "finance", role: "member" });
  mockStore.upsertMembership({ userId: DEV_USER, roomId: "development", role: "member" });
  mockStore.upsertMembership({ userId: MEETING_USER, roomId: "meeting", role: "member" });
});

describe("목록 조회 라우트 인가 — 테넌트 격리 (P0 회귀)", () => {
  describe("GET /api/shared-items", () => {
    it("roomId 미지정 시 호출자가 멤버인 방의 항목만 반환한다(전역 노출 차단)", async () => {
      const mine = mockStore.createSharedItem({
        sourceRoomId: "finance",
        targetRoomId: "meeting",
        title: "ISO finance shared",
        summary: "x",
      });
      const other = mockStore.createSharedItem({
        sourceRoomId: "planning",
        targetRoomId: "research",
        title: "ISO other tenant shared",
        summary: "y",
      });

      asUser(FINANCE_USER);
      const res = await sharedItemsGET(new Request("http://localhost/api/shared-items"));
      expect(res.status).toBe(200);
      const ids = (await res.json()).sharedItems.map((item: { id: string }) => item.id);

      expect(ids).toContain(mine.id);
      // 수정 전에는 roomId 미지정 시 전체 테넌트 항목을 반환했다 — 이 단언이 그 회귀를 막는다.
      expect(ids).not.toContain(other.id);
    });

    it("멤버가 아닌 roomId는 403으로 거부한다", async () => {
      asUser(FINANCE_USER);
      const res = await sharedItemsGET(new Request("http://localhost/api/shared-items?roomId=planning"));
      expect(res.status).toBe(403);
    });

    it("멤버인 roomId는 그 방 스코프로만 반환한다", async () => {
      const mine = mockStore.createSharedItem({
        sourceRoomId: "finance",
        targetRoomId: "meeting",
        title: "ISO finance scoped",
        summary: "x",
      });
      const other = mockStore.createSharedItem({
        sourceRoomId: "planning",
        targetRoomId: "research",
        title: "ISO other scoped",
        summary: "y",
      });

      asUser(FINANCE_USER);
      const res = await sharedItemsGET(new Request("http://localhost/api/shared-items?roomId=finance"));
      const ids = (await res.json()).sharedItems.map((item: { id: string }) => item.id);

      expect(ids).toContain(mine.id);
      expect(ids).not.toContain(other.id);
    });
  });

  describe("GET /api/meeting-imports", () => {
    it("roomId 미지정 시 호출자가 멤버인 방의 반입 항목만 반환한다", async () => {
      const mine = mockStore.createImport({ targetRoomId: "development", meetingRoomId: "meeting", status: "pending" });
      const other = mockStore.createImport({ targetRoomId: "research", meetingRoomId: "meeting", status: "pending" });

      asUser(DEV_USER);
      const res = await meetingImportsGET(new Request("http://localhost/api/meeting-imports"));
      expect(res.status).toBe(200);
      const ids = (await res.json()).imports.map((item: { id: string }) => item.id);

      expect(ids).toContain(mine.id);
      // DEV_USER는 research·meeting 멤버가 아니므로 other를 보면 안 된다.
      expect(ids).not.toContain(other.id);
    });

    it("멤버가 아닌 roomId는 403으로 거부한다", async () => {
      asUser(DEV_USER);
      const res = await meetingImportsGET(new Request("http://localhost/api/meeting-imports?roomId=research"));
      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/decisions", () => {
    it("meeting 멤버는 결정사항을 조회할 수 있다", async () => {
      asUser(MEETING_USER);
      const res = await decisionsGET();
      expect(res.status).toBe(200);
    });

    it("자신이 속한 다른 방이 있어도 meeting 비멤버는 403으로 거부한다", async () => {
      // 수정 전에는 ?roomId=finance 로 finance 멤버십만 통과시키고 meeting 결정사항을 반환했다.
      // 이제 roomId 분기를 없애 항상 meeting 멤버십을 강제한다.
      asUser(FINANCE_USER);
      const res = await decisionsGET();
      expect(res.status).toBe(403);
    });
  });
});

describe("share-import-service 격리 단위 검증", () => {
  it("listVisibleSharedItems는 roomId 미지정 시 비멤버 방 항목을 제외한다", async () => {
    const mine = mockStore.createSharedItem({
      sourceRoomId: "finance",
      targetRoomId: "meeting",
      title: "svc finance",
      summary: "x",
    });
    const other = mockStore.createSharedItem({
      sourceRoomId: "planning",
      targetRoomId: "research",
      title: "svc other",
      summary: "y",
    });

    const visible = await listVisibleSharedItems({ userId: FINANCE_USER });
    const ids = visible.map((item) => item.id);
    expect(ids).toContain(mine.id);
    expect(ids).not.toContain(other.id);
  });

  it("listVisibleMeetingImports는 비멤버 roomId에 ForbiddenError를 던진다", async () => {
    await expect(listVisibleMeetingImports({ userId: DEV_USER, roomId: "research" })).rejects.toMatchObject({
      status: 403,
    });
  });
});
