import { describe, expect, it } from "vitest";
import { mockUser } from "@/lib/mock-data";
import { mockStore } from "@/server/data/mock-store";
import { shareMessageToMeeting } from "@/server/collaboration/share-import-service";
import { getOperationStatus } from "@/server/office/operation-status-service";

describe("operation status", () => {
  it("counts today's shared items, completed meeting briefings, and active tasks", async () => {
    const before = await getOperationStatus(mockUser.userId);

    await shareMessageToMeeting({
      userId: mockUser.userId,
      sourceRoomId: "finance",
      title: "운영 상태 테스트 공유",
      summary: "오늘 공유 카운트에 반영됩니다.",
    });
    mockStore.createAgentRun({
      roomId: "meeting",
      threadId: mockStore.ensureRoomThread("meeting").id,
      agentId: "finance_bot",
      initiatedBy: mockUser.userId,
      mode: "meeting_guest",
      runType: "meeting_guest",
      status: "completed",
    });
    mockStore.createTask({
      roomId: "development",
      title: "운영 상태 테스트 할 일",
      createdBy: mockUser.userId,
    });

    const after = await getOperationStatus(mockUser.userId);

    expect(after.sharedCount).toBeGreaterThanOrEqual(before.sharedCount + 1);
    expect(after.briefingCount).toBeGreaterThanOrEqual(before.briefingCount + 1);
    expect(after.taskCount).toBeGreaterThanOrEqual(before.taskCount + 1);
  });
});
