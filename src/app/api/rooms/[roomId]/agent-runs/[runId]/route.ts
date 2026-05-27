import { jsonError, jsonOk } from "@/lib/api";
import { shouldUseMockData } from "@/lib/env";
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
    const run = (await source.listAgentRuns()).find((item) => item.id === runId && item.roomId === roomId);

    if (!run) {
      const error = new Error("봇 실행을 찾을 수 없습니다.") as Error & { status: number };
      error.status = 404;
      throw error;
    }

    const outputMessage = run.outputMessageId
      ? (await source.listMessages(roomId, run.threadId)).find((message) => message.id === run.outputMessageId)
      : null;

    return jsonOk({ run, outputMessage });
  } catch (error) {
    return jsonError(error);
  }
}
