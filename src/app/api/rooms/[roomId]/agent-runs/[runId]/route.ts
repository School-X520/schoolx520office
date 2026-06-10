import { jsonError, jsonOk } from "@/lib/api";
import { shouldUseMockData } from "@/lib/env";
import { publicAgentRunActivity } from "@/server/agents/agent-run-activity";
import { cancelAgentRun } from "@/server/agents/run-agent";
import { requireRoomMember } from "@/server/auth/require-room-member";
import { requireUser } from "@/server/auth/require-user";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";

export async function GET(_: Request, { params }: { params: Promise<{ roomId: string; runId: string }> }) {
  try {
    const { roomId, runId } = await params;
    const user = await requireUser();
    await requireRoomMember(user.userId, roomId);

    const source = shouldUseMockData() ? mockStore : supabaseStore;
    const candidate = await source.getAgentRunById(runId);
    const run = candidate && candidate.roomId === roomId ? candidate : null;

    if (!run) {
      const error = new Error("봇 실행을 찾을 수 없습니다.") as Error & { status: number };
      error.status = 404;
      throw error;
    }

    const outputMessage = run.outputMessageId
      ? (await source.listMessages(roomId, run.threadId)).find((message) => message.id === run.outputMessageId)
      : null;
    const events = await source.listAgentRunEvents(runId);

    return jsonOk({ run, outputMessage, activity: publicAgentRunActivity(run, events) }, noStoreJsonInit);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ roomId: string; runId: string }> }) {
  try {
    const { roomId, runId } = await params;
    const user = await requireUser();
    const result = await cancelAgentRun({
      userId: user.userId,
      roomId,
      runId,
    });

    return jsonOk(result, noStoreJsonInit);
  } catch (error) {
    return jsonError(error);
  }
}

const noStoreJsonInit = {
  headers: {
    "cache-control": "no-store",
  },
} satisfies ResponseInit;
