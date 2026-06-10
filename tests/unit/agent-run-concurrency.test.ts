import { describe, expect, it } from "vitest";

import { mockUser } from "@/lib/mock-data";
import { startAgentRun } from "@/server/agents/run-agent";
import { mockStore } from "@/server/data/mock-store";

function seedRun(roomId: string, status: "queued" | "running" | "completed", startedAtIso?: string) {
  const run = mockStore.createAgentRun({
    roomId,
    threadId: `${roomId}-thread-default`,
    agentId: `${roomId}_bot`,
    mode: "room",
    runType: "room_agent",
    status,
  });
  if (startedAtIso) {
    run.startedAt = startedAtIso;
  }
  return run;
}

describe("claimAgentRunForExecution", () => {
  it("queued 실행을 running으로 원자적 전이하고, 두 번째 점유는 null", () => {
    const run = seedRun("promotion", "queued");

    const claimed = mockStore.claimAgentRunForExecution(run.id);
    expect(claimed?.status).toBe("running");

    // 두 번째 워커는 이미 점유된 실행을 다시 점유하지 못한다(중복 실행 방지).
    expect(mockStore.claimAgentRunForExecution(run.id)).toBeNull();
  });

  it("queued가 아닌 실행은 점유하지 않는다", () => {
    const run = seedRun("promotion", "completed");
    expect(mockStore.claimAgentRunForExecution(run.id)).toBeNull();
  });
});

describe("listActiveAgentRunsForRoom", () => {
  it("해당 방의 비종결 실행만 반환한다", () => {
    seedRun("external", "queued");
    seedRun("external", "running");
    seedRun("external", "completed");
    seedRun("finance", "running");

    const active = mockStore.listActiveAgentRunsForRoom("external");
    expect(active.length).toBe(2);
    expect(active.every((run) => run.roomId === "external")).toBe(true);
    expect(active.some((run) => run.status === "completed")).toBe(false);
  });
});

describe("startAgentRun 동시 실행 제한", () => {
  it("방당 활성 실행 상한을 넘으면 429로 거부한다", async () => {
    seedRun("research", "running");
    seedRun("research", "running");
    seedRun("research", "running");

    await expect(
      startAgentRun({
        userId: mockUser.userId,
        roomId: "research",
        agentId: "research_bot",
        message: "한도 초과 테스트",
        mode: "room",
      }),
    ).rejects.toMatchObject({ status: 429 });
  });

  it("좀비 실행(타임아웃 초과)은 자동 종료되고 슬롯을 차지하지 않는다", async () => {
    const stale = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const zombie1 = seedRun("planning", "running", stale);
    const zombie2 = seedRun("planning", "running", stale);
    const zombie3 = seedRun("planning", "running", stale);

    const started = await startAgentRun({
      userId: mockUser.userId,
      roomId: "planning",
      agentId: "planning_bot",
      message: "좀비 정리 후 정상 실행",
      mode: "room",
    });

    expect(started.run.roomId).toBe("planning");
    for (const zombie of [zombie1, zombie2, zombie3]) {
      expect(mockStore.getAgentRunById(zombie.id)?.status).toBe("failed");
    }
  });
});
