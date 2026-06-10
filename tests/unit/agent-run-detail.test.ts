import { describe, expect, it } from "vitest";

import { mockUser } from "@/lib/mock-data";
import { getAgentRunDetail } from "@/server/agents/get-agent-run-detail";
import { mockStore } from "@/server/data/mock-store";

describe("getAgentRunDetail", () => {
  it("run과 출력 메시지, 활동을 조립한다", async () => {
    const thread = mockStore.ensureRoomThread("research");
    const output = mockStore.createMessage({
      roomId: "research",
      threadId: thread.id,
      type: "agent",
      content: "봇 응답",
    });
    const run = mockStore.createAgentRun({
      roomId: "research",
      threadId: thread.id,
      agentId: "research_bot",
      mode: "room",
      runType: "room_agent",
      status: "completed",
      outputMessageId: output.id,
    });

    const detail = await getAgentRunDetail({ userId: mockUser.userId, roomId: "research", runId: run.id });
    expect(detail.run.id).toBe(run.id);
    expect(detail.outputMessage?.id).toBe(output.id);
    expect(Array.isArray(detail.activity)).toBe(true);
  });

  it("요청한 방과 run의 방이 다르면 404로 거부한다", async () => {
    const run = mockStore.createAgentRun({
      roomId: "research",
      threadId: "research-thread-default",
      agentId: "research_bot",
      mode: "room",
      runType: "room_agent",
    });
    await expect(
      getAgentRunDetail({ userId: mockUser.userId, roomId: "planning", runId: run.id }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("존재하지 않는 run은 404", async () => {
    await expect(
      getAgentRunDetail({ userId: mockUser.userId, roomId: "research", runId: "does-not-exist" }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
