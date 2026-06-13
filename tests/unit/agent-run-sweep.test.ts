import { describe, expect, it } from "vitest";
import { mockStore } from "@/server/data/mock-store";
import { sweepStuckAgentRuns } from "@/server/agents/run-agent";

const FIVE_MIN = 5 * 60 * 1000;

describe("sweepStuckAgentRuns (좀비 run 전역 백스톱)", () => {
  it("타임아웃을 넘긴 active run을 failed로 정리하고 신규 run은 유지한다", async () => {
    const stuck = mockStore.createAgentRun({ roomId: "finance", mode: "room", runType: "room_agent", status: "running" });
    // startedAt을 10분 전으로 되돌려 좀비 상태를 만든다(after() 콜백 유실 시뮬레이션).
    mockStore.updateAgentRun(stuck.id, { startedAt: new Date(Date.now() - 2 * FIVE_MIN).toISOString() });
    const fresh = mockStore.createAgentRun({ roomId: "finance", mode: "room", runType: "room_agent", status: "running" });

    const result = await sweepStuckAgentRuns();

    expect(mockStore.getAgentRunById(stuck.id)?.status).toBe("failed");
    expect(mockStore.getAgentRunById(stuck.id)?.error).toContain("초과");
    expect(mockStore.getAgentRunById(fresh.id)?.status).toBe("running");
    expect(result.swept).toBeGreaterThanOrEqual(1);
  });

  it("이미 종결된(terminal) run은 건드리지 않는다", async () => {
    const done = mockStore.createAgentRun({ roomId: "planning", mode: "room", runType: "room_agent", status: "completed" });
    mockStore.updateAgentRun(done.id, { startedAt: new Date(Date.now() - 12 * FIVE_MIN).toISOString() });

    await sweepStuckAgentRuns();

    expect(mockStore.getAgentRunById(done.id)?.status).toBe("completed");
  });
});
