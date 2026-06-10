import { describe, expect, it } from "vitest";

import { mergeMessages, mergeServerMessages } from "@/lib/merge-messages";
import type { RoomMessage } from "@/types/domain";

function message(overrides: Partial<RoomMessage> & Pick<RoomMessage, "id" | "createdAt">): RoomMessage {
  return {
    roomId: "research",
    threadId: "research-thread-default",
    senderUserId: "user-1",
    senderAgentId: null,
    agentRunId: null,
    type: "human",
    content: "본문",
    metadata: {},
    ...overrides,
  };
}

describe("mergeMessages", () => {
  it("id로 중복을 제거하고 생성 시각순으로 정렬한다", () => {
    const current = [message({ id: "b", createdAt: "2026-06-10T00:00:02Z" })];
    const incoming = [
      message({ id: "a", createdAt: "2026-06-10T00:00:01Z" }),
      message({ id: "b", createdAt: "2026-06-10T00:00:02Z", content: "갱신됨" }),
    ];
    const merged = mergeMessages(current, incoming);
    expect(merged.map((m) => m.id)).toEqual(["a", "b"]);
    expect(merged[1].content).toBe("갱신됨");
  });

  it("기존 메시지를 제거하지 않는다(낙관적/대기 메시지 보존)", () => {
    const current = [message({ id: "optimistic-1", createdAt: "2026-06-10T00:00:05Z" })];
    const merged = mergeMessages(current, [message({ id: "server-1", createdAt: "2026-06-10T00:00:01Z" })]);
    expect(merged.map((m) => m.id)).toContain("optimistic-1");
  });
});

describe("mergeServerMessages", () => {
  it("서버에 실제 봇 출력이 도착하면 같은 run의 pending 메시지를 제거한다", () => {
    const current = [
      message({
        id: "pending-run-1",
        createdAt: "2026-06-10T00:00:01Z",
        agentRunId: "run-1",
        type: "agent",
        metadata: { pendingAgentRun: true },
      }),
    ];
    const server = [
      message({
        id: "real-output",
        createdAt: "2026-06-10T00:00:03Z",
        agentRunId: "run-1",
        type: "agent",
        content: "봇 응답",
      }),
    ];
    const merged = mergeServerMessages(current, server);
    expect(merged.map((m) => m.id)).toEqual(["real-output"]);
    expect(merged.some((m) => m.metadata.pendingAgentRun)).toBe(false);
  });

  it("아직 출력이 없는 pending 메시지는 보존한다", () => {
    const current = [
      message({
        id: "pending-run-2",
        createdAt: "2026-06-10T00:00:01Z",
        agentRunId: "run-2",
        type: "agent",
        metadata: { pendingAgentRun: true },
      }),
    ];
    const server = [message({ id: "other-user-msg", createdAt: "2026-06-10T00:00:02Z" })];
    const merged = mergeServerMessages(current, server);
    expect(merged.map((m) => m.id).sort()).toEqual(["other-user-msg", "pending-run-2"]);
  });
});
