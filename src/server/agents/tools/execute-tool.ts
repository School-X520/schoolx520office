import "server-only";

import { shouldUseMockData } from "@/lib/env";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";
import { shareMessageToMeeting, importMeetingMessageToRoom } from "@/server/collaboration/share-import-service";
import { toolRegistry } from "@/server/agents/tools/tool-registry";

export async function executeTool(agentRunId: string, toolName: string, input: Record<string, unknown>) {
  const source = shouldUseMockData() ? mockStore : supabaseStore;
  const run = (await source.listAgentRuns()).find((item) => item.id === agentRunId);
  const definition = toolRegistry.find((tool) => tool.name === toolName);

  if (!run || !definition) {
    return { ok: false, error: "invalid_agent_run_or_tool" };
  }

  await source.addAuditLog({
    actorAgentId: run.agentId ?? undefined,
    roomId: run.roomId,
    action: "agent.tool.called",
    targetType: "agent_tool_call",
    targetId: agentRunId,
    metadata: { toolName, input },
  });

  if (toolName === "read_room_summary") {
    return { ok: true, data: await source.getMemory(String(input.room_id ?? run.roomId)) };
  }

  if (toolName === "share_item_to_meeting") {
    const item = await shareMessageToMeeting({
      userId: run.initiatedBy ?? "",
      sourceRoomId: String(input.source_room_id ?? run.roomId),
      sourceMessageId: input.source_message_id ? String(input.source_message_id) : undefined,
      sourceFileId: input.source_file_id ? String(input.source_file_id) : undefined,
      title: String(input.title ?? "봇 공유 항목"),
      summary: String(input.summary ?? "봇이 회의방으로 공유한 항목입니다."),
    });
    return { ok: true, data: item };
  }

  if (toolName === "import_meeting_item_to_room") {
    const item = await importMeetingMessageToRoom({
      userId: run.initiatedBy ?? "",
      targetRoomId: String(input.target_room_id),
      sharedItemId: input.shared_item_id ? String(input.shared_item_id) : undefined,
      sourceMessageId: input.source_message_id ? String(input.source_message_id) : undefined,
      sourceFileId: input.source_file_id ? String(input.source_file_id) : undefined,
    });
    return { ok: true, data: item };
  }

  if (toolName === "propose_memory_write") {
    const review = await source.addMemoryReview({
      roomId: String(input.room_id ?? run.roomId),
      agentRunId,
      proposedMemory: input.proposed_memory as Record<string, unknown>,
    });
    return { ok: true, data: review };
  }

  return { ok: true, data: { status: "mock-noop", toolName } };
}
