import "server-only";

import { shouldUseMockData } from "@/lib/env";
import { getAgentAdapter } from "@/server/agents/get-agent-adapter";
import { finalizeAgentRun } from "@/server/agents/finalize-agent-run";
import { createRoomMessage } from "@/server/messages/room-message-service";
import { getAgentStartupContext } from "@/server/memory/domain-memory-service";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";
import { requireRoomMember } from "@/server/auth/require-room-member";
import type { AgentRunMode, AgentRunType } from "@/types/domain";

export async function runAgent(input: {
  userId: string;
  roomId: string;
  agentId?: string;
  message: string;
  mode?: AgentRunMode;
  runType?: AgentRunType;
  guestSourceRoomId?: string | null;
}) {
  await requireRoomMember(input.userId, input.roomId);
  if (input.guestSourceRoomId) {
    await requireRoomMember(input.userId, input.guestSourceRoomId);
  }
  const source = shouldUseMockData() ? mockStore : supabaseStore;

  const agent = input.agentId
    ? await source.getAgent(input.agentId)
    : await source.getAgentByRoom(input.guestSourceRoomId ?? input.roomId);

  if (!agent) {
    throw new Error("연결된 봇이 없습니다.");
  }

  const inputMessage = await createRoomMessage({
    userId: input.userId,
    roomId: input.roomId,
    content: input.message,
    type: "human",
  });

  const run = await source.createAgentRun({
    roomId: input.roomId,
    agentId: agent.id,
    initiatedBy: input.userId,
    mode: input.mode ?? "room",
    runType: input.runType ?? (input.mode === "meeting_guest" ? "meeting_guest" : "room_agent"),
    guestSourceRoomId: input.guestSourceRoomId ?? null,
    inputMessageId: inputMessage.id,
    status: "running",
  });

  await source.addAuditLog({
    actorUserId: input.userId,
    actorAgentId: agent.id,
    roomId: input.roomId,
    action: "agent.run.started",
    targetType: "agent_run",
    targetId: run.id,
  });

  try {
    const adapter = getAgentAdapter();
    const startupContext = await getAgentStartupContext(input.guestSourceRoomId ?? input.roomId, input.mode ?? "room");
    const result = await adapter.run({
      roomId: input.roomId,
      agentId: agent.id,
      userId: input.userId,
      message: input.message,
      mode: input.mode ?? "room",
      guestSourceRoomId: input.guestSourceRoomId ?? null,
      startupContext,
    });

    for (const event of result.events ?? []) {
      await source.addAgentRunEvent(run.id, event.type, event.payload);
    }

    const outputMessage = await source.createMessage({
      roomId: input.roomId,
      type: input.mode === "meeting_guest" ? "guest_agent" : "agent",
      content: result.content,
      senderUserId: null,
      senderAgentId: agent.id,
      agentRunId: run.id,
      metadata: {
        sourceRoomId: input.guestSourceRoomId ?? agent.roomId,
        guestLabel: input.mode === "meeting_guest" ? agent.name : undefined,
        autoExitAfterTurns: input.mode === "meeting_guest" ? 3 : undefined,
      },
    });

    await source.updateAgentRun(run.id, {
      status: result.requiresAction ? "requires_action" : "completed",
      anthropicSessionId: result.anthropicSessionId ?? null,
      outputMessageId: outputMessage.id,
      tokenUsage: result.tokenUsage ?? {},
      endedAt: new Date().toISOString(),
    });

    await source.addAuditLog({
      actorUserId: input.userId,
      actorAgentId: agent.id,
      roomId: input.roomId,
      action: "agent.run.completed",
      targetType: "agent_run",
      targetId: run.id,
    });

    await finalizeAgentRun(run.id);
    return { run: await source.updateAgentRun(run.id, { status: "completed" }), outputMessage };
  } catch (error) {
    await source.updateAgentRun(run.id, {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
      endedAt: new Date().toISOString(),
    });
    await source.addAuditLog({
      actorUserId: input.userId,
      actorAgentId: agent.id,
      roomId: input.roomId,
      action: "agent.run.failed",
      targetType: "agent_run",
      targetId: run.id,
      metadata: { error: error instanceof Error ? error.message : error },
    });
    throw error;
  }
}
