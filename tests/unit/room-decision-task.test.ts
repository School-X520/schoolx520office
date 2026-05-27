import { describe, expect, it } from "vitest";
import { mockUser } from "@/lib/mock-data";
import { mockStore } from "@/server/data/mock-store";
import { getRoomView } from "@/server/rooms/get-room-view";

describe("room decisions and tasks", () => {
  it("hides inactive city research room and keeps renamed project rooms active", async () => {
    const rooms = mockStore.listRooms();

    expect(rooms.map((room) => room.id)).not.toContain("city_research");
    expect(rooms.find((room) => room.id === "province_research")?.name).toBe("경기도교육연구회");
    expect(rooms.find((room) => room.id === "science_museum")?.name).toBe("과학관 AI교육 연구회");
    await expect(getRoomView(mockUser.userId, "city_research")).resolves.toBeNull();
  });

  it("shows meeting decisions in every room view", async () => {
    const decision = mockStore.createDecision({
      roomId: "meeting",
      title: "전체 방 반영 결정사항 테스트",
      description: "메인 회의방 결정사항은 모든 방에 표시됩니다.",
      decidedBy: mockUser.userId,
    });

    const financeView = await getRoomView(mockUser.userId, "finance");

    expect(financeView?.decisions.map((item) => item.id)).toContain(decision.id);
  });

  it("shows a targeted task only in meeting and selected rooms", () => {
    const task = mockStore.createTask({
      roomId: "meeting",
      title: "개발방 전용 할 일 테스트",
      assigneeRoomId: "development",
      createdBy: mockUser.userId,
    });

    expect(mockStore.listTasks("meeting").map((item) => item.id)).toContain(task.id);
    expect(mockStore.listTasks("development").map((item) => item.id)).toContain(task.id);
    expect(mockStore.listTasks("finance").map((item) => item.id)).not.toContain(task.id);
  });
});
