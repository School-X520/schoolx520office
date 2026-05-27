import { describe, expect, it } from "vitest";
import { getManagedAgentToolConfigs, toolRegistry } from "@/server/agents/tools/tool-registry";

describe("toolRegistry", () => {
  it("keeps memory writes behind review tooling", () => {
    expect(toolRegistry.find((tool) => tool.name === "propose_memory_write")?.risk).toBe("high");
    expect(toolRegistry.find((tool) => tool.name === "read_room_summary")?.writes).toBe(false);
  });

  it("exports SchoolX tools as Claude Managed Agents custom tools", () => {
    const toolConfigs = getManagedAgentToolConfigs();
    expect(toolConfigs.find((tool) => tool.type === "agent_toolset_20260401")).toBeTruthy();
    expect(
      toolConfigs.find((tool) => tool.type === "custom" && "name" in tool && tool.name === "search_room_messages"),
    ).toMatchObject({
      input_schema: expect.objectContaining({ type: "object" }),
    });
  });
});
