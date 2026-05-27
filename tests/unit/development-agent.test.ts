import { describe, expect, it } from "vitest";
import { DEVELOPMENT_AGENT_ID } from "@/lib/agents/development-agent";
import { mockUser } from "@/lib/mock-data";
import { executeTool } from "@/server/agents/tools/execute-tool";
import { startAgentRun } from "@/server/agents/run-agent";
import { mockStore } from "@/server/data/mock-store";
import { getProjectObserverContext } from "@/server/memory/domain-memory-service";
import { getRoomView } from "@/server/rooms/get-room-view";

describe("development bot global room observer", () => {
  it("shows the development bot as an extra callable bot in other work rooms", async () => {
    const financeView = await getRoomView(mockUser.userId, "finance");
    const developmentView = await getRoomView(mockUser.userId, "development");

    expect(financeView?.agent?.id).toBe("finance_bot");
    expect(financeView?.guestAgents?.map((agent) => agent.id)).toContain(DEVELOPMENT_AGENT_ID);
    expect(developmentView?.agent?.id).toBe(DEVELOPMENT_AGENT_ID);
    expect(developmentView?.guestAgents?.map((agent) => agent.id)).not.toContain(DEVELOPMENT_AGENT_ID);
  });

  it("allows the development bot to run inside another room", async () => {
    const started = await startAgentRun({
      userId: mockUser.userId,
      roomId: "finance",
      agentId: DEVELOPMENT_AGENT_ID,
      message: "이 예산 대화에서 개발할 기능을 찾아줘.",
      mode: "room",
    });

    expect(started.run.roomId).toBe("finance");
    expect(started.run.agentId).toBe(DEVELOPMENT_AGENT_ID);
    expect(started.run.mode).toBe("room");
  });

  it("lets the development bot search accessible room conversations beyond the active room", async () => {
    const planningThread = mockStore.ensureRoomThread("planning");
    const uniquePlanningMessage = "개발봇 전역 관찰 테스트용 기획 대화";
    mockStore.createMessage({
      roomId: "planning",
      threadId: planningThread.id,
      type: "human",
      content: uniquePlanningMessage,
      senderUserId: mockUser.userId,
    });

    const developmentRun = mockStore.createAgentRun({
      roomId: "finance",
      threadId: mockStore.ensureRoomThread("finance").id,
      agentId: DEVELOPMENT_AGENT_ID,
      initiatedBy: mockUser.userId,
      mode: "room",
      runType: "room_agent",
    });
    const developmentResult = await executeTool(developmentRun.id, "search_room_messages", {
      room_id: "planning",
      query: uniquePlanningMessage,
      limit: 5,
    });

    expect(developmentResult.ok).toBe(true);
    expect(JSON.stringify(developmentResult)).toContain(uniquePlanningMessage);

    const financeRun = mockStore.createAgentRun({
      roomId: "finance",
      threadId: mockStore.ensureRoomThread("finance").id,
      agentId: "finance_bot",
      initiatedBy: mockUser.userId,
      mode: "room",
      runType: "room_agent",
    });
    const financeResult = await executeTool(financeRun.id, "search_room_messages", {
      room_id: "planning",
      query: uniquePlanningMessage,
    });

    expect(financeResult.ok).toBe(false);
    expect(financeResult.error).toContain("tool_room_out_of_scope");
  });

  it("builds a project overview from all rooms the user can read", async () => {
    const overview = await getProjectObserverContext(mockUser.userId, {
      currentRoomId: "finance",
      messageLimitPerRoom: 2,
    });

    expect(overview.currentRoomId).toBe("finance");
    expect(overview.rooms.map((room) => room.room.id)).toContain("finance");
    expect(overview.rooms.map((room) => room.room.id)).toContain("development");
    expect(overview.readableRoomCount).toBeGreaterThan(1);
  });
});
