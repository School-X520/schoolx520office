import { describe, expect, it } from "vitest";
import { mergeMemoryPatch } from "@/server/memory/domain-memory-service";
import type { DomainMemory } from "@/types/domain";

const base: DomainMemory = {
  roomId: "research",
  summary: "old",
  activeTasks: [],
  decisions: [],
  keyFacts: [],
  pendingContext: [{ id: "a" }],
  processedContext: [],
  metadata: {},
  updatedAt: "2026-05-08T00:00:00Z",
};

describe("mergeMemoryPatch", () => {
  it("preserves pending context when patch omits it", () => {
    const merged = mergeMemoryPatch(base, { summary: "new" });
    expect(merged.summary).toBe("new");
    expect(merged.pendingContext).toEqual([{ id: "a" }]);
  });
});
