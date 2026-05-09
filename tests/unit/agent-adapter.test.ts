import { describe, expect, it } from "vitest";
import { MockAgentAdapter } from "@/server/agents/mock-agent-adapter";

describe("MockAgentAdapter", () => {
  it("returns a Korean mock response", async () => {
    const adapter = new MockAgentAdapter();
    const result = await adapter.run({
      roomId: "finance",
      agentId: "finance_bot",
      userId: "user",
      message: "예산 확인",
      mode: "room",
    });
    expect(result.content).toContain("재무봇");
    expect(result.tokenUsage?.mode).toBe("mock");
  });
});
