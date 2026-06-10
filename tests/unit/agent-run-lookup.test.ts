import { describe, expect, it } from "vitest";

import { mockStore } from "@/server/data/mock-store";

describe("getAgentRunById", () => {
  it("id로 단건 실행을 조회한다", () => {
    const created = mockStore.createAgentRun({
      roomId: "research",
      threadId: "research-thread-default",
      agentId: null,
      mode: "room",
      runType: "room_agent",
    });

    const found = mockStore.getAgentRunById(created.id);
    expect(found?.id).toBe(created.id);
    expect(found?.roomId).toBe("research");
  });

  it("존재하지 않는 id에는 null을 반환한다", () => {
    expect(mockStore.getAgentRunById("does-not-exist")).toBeNull();
  });
});
