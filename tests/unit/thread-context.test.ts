import { describe, expect, it } from "vitest";
import { getAgentMemoryAttachments, getAgentStartupContext } from "@/server/memory/domain-memory-service";
import { createRoomThread, buildCarryoverSummary } from "@/server/rooms/thread-service";
import { buildManagedSessionResources } from "@/server/agents/claude-managed-agent-adapter";
import { mockStore } from "@/server/data/mock-store";
import { mockUser } from "@/lib/mock-data";

describe("thread context", () => {
  it("limits startup context to the selected thread", async () => {
    const firstThread = mockStore.ensureRoomThread("finance");
    const secondThread = mockStore.createThread({
      roomId: "finance",
      title: "별도 예산 대화",
      carryoverSummary: "예산 업무만 이어받습니다.",
    });

    mockStore.createMessage({
      roomId: "finance",
      threadId: firstThread.id,
      type: "human",
      content: "첫 번째 thread의 오래된 논의",
    });
    mockStore.createMessage({
      roomId: "finance",
      threadId: secondThread.id,
      type: "human",
      content: "두 번째 thread의 현재 논의",
    });

    const context = await getAgentStartupContext("finance", "room", {
      threadId: secondThread.id,
      messageLimit: 10,
    });

    expect(context.thread?.id).toBe(secondThread.id);
    expect(context.recentMessages.map((message) => message.content)).toContain("두 번째 thread의 현재 논의");
    expect(context.recentMessages.map((message) => message.content)).not.toContain("첫 번째 thread의 오래된 논의");
  });

  it("creates new threads with summary carryover instead of full message carryover", async () => {
    const thread = await createRoomThread(mockUser.userId, "planning", "새 기획 대화");

    expect(thread.title).toBe("새 기획 대화");
    expect(thread.carryoverSummary).toContain("방 장기 요약");
    expect(thread.carryoverSummary).not.toContain("messages");
  });

  it("returns read-only Claude memory attachments when a room memory store is linked", async () => {
    const [store] = mockStore.listRoomMemoryStores("research");
    store.anthropicMemoryStoreId = "mem_research_123";

    const attachments = await getAgentMemoryAttachments("research", "read_only");

    expect(attachments).toEqual([
      expect.objectContaining({
        roomId: "research",
        memoryStoreId: "mem_research_123",
        accessMode: "read_only",
      }),
    ]);
  });

  it("builds Claude Managed Agent memory store resources as read-only", () => {
    const resources = buildManagedSessionResources([], [
      {
        roomId: "research",
        memoryStoreId: "mem_research_123",
        accessMode: "read_only",
        purpose: "Research room memory",
      },
    ]);

    expect(resources.memoryResources).toEqual([
      expect.objectContaining({
        type: "memory_store",
        memory_store_id: "mem_research_123",
        access: "read_only",
      }),
    ]);
  });

  it("builds carryover summaries from durable memory, decisions, and active tasks", () => {
    const summary = buildCarryoverSummary({
      memory: mockStore.getMemory("development"),
      previousThread: mockStore.ensureRoomThread("development"),
      decisions: mockStore.listDecisions("meeting"),
      tasks: mockStore.listTasks("development"),
    });

    expect(summary).toContain("방 장기 요약");
    expect(summary).toContain("미해결 할 일");
  });
});
