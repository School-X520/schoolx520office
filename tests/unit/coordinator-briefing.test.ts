import { describe, expect, it } from "vitest";
import { COORDINATOR_AGENT_ID } from "@/lib/agents/development-agent";
import { rooms, mockUser } from "@/lib/mock-data";
import { runAgent, startAgentRun } from "@/server/agents/run-agent";
import {
  generateCoordinatorBriefing,
  getCoordinatorBriefingSnapshot,
} from "@/server/coordinator/coordinator-briefing-service";
import { getRoomView } from "@/server/rooms/get-room-view";

describe("coordinator briefing", () => {
  it("collects structured room reports and creates a main coordinator briefing", async () => {
    const snapshot = await generateCoordinatorBriefing(mockUser);
    const activeWorkRoomIds = rooms
      .filter((room) => room.isActive && room.type !== "meeting")
      .map((room) => room.id);

    expect(snapshot.briefing?.summary).toContain("구조화 보고");
    expect(snapshot.roomBriefings.map((briefing) => briefing.roomId).sort()).toEqual(activeWorkRoomIds.sort());
    expect(snapshot.briefing?.roomHighlights.map((item) => item.roomId).sort()).toEqual(activeWorkRoomIds);
    expect(snapshot.briefing?.metadata).toMatchObject({
      role: "operations_pm",
      allRoomSearchGranted: true,
    });
  });

  it("returns the latest coordinator snapshot without generating a new one", async () => {
    const generated = await generateCoordinatorBriefing(mockUser);
    const latest = await getCoordinatorBriefingSnapshot(mockUser);

    expect(latest.briefing?.id).toBe(generated.briefing?.id);
    expect(latest.roomBriefings.length).toBeGreaterThan(0);
  });

  it("exposes the coordinator bot only as an on-demand main room guest", async () => {
    const meetingView = await getRoomView(mockUser.userId, "meeting");
    const financeView = await getRoomView(mockUser.userId, "finance");

    expect(meetingView?.agent).toBeUndefined();
    expect(meetingView?.guestAgents?.map((agent) => agent.id)).toContain(COORDINATOR_AGENT_ID);
    expect(financeView?.guestAgents?.map((agent) => agent.id)).not.toContain(COORDINATOR_AGENT_ID);
  });

  it("answers in the main room when the coordinator bot is explicitly requested", async () => {
    const started = await startAgentRun({
      userId: mockUser.userId,
      roomId: "meeting",
      agentId: COORDINATOR_AGENT_ID,
      message: "총괄 브리핑 해줘.",
      mode: "meeting_guest",
      guestSourceRoomId: "meeting",
    });
    expect(started.run.agentId).toBeNull();
    expect(started.run.metadata).toMatchObject({ coordinatorAgentId: COORDINATOR_AGENT_ID });

    const completed = await runAgent({
      userId: mockUser.userId,
      roomId: "meeting",
      agentId: COORDINATOR_AGENT_ID,
      message: "총괄 브리핑 해줘.",
      mode: "meeting_guest",
      guestSourceRoomId: "meeting",
    });

    expect(completed.outputMessage.content).toContain("총괄 브리핑");
    expect(completed.outputMessage.metadata).toMatchObject({ guestLabel: "총괄봇" });
  });
});
