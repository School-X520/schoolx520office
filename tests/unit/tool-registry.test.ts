import { describe, expect, it } from "vitest";
import { toolRegistry } from "@/server/agents/tools/tool-registry";

describe("toolRegistry", () => {
  it("keeps memory writes behind review tooling", () => {
    expect(toolRegistry.find((tool) => tool.name === "propose_memory_write")?.risk).toBe("high");
    expect(toolRegistry.find((tool) => tool.name === "read_room_summary")?.writes).toBe(false);
  });
});
