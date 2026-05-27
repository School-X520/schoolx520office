import { after } from "next/server";
import { jsonError, jsonOk } from "@/lib/api";
import { completeAgentRun, startAgentRun } from "@/server/agents/run-agent";
import { requireUser } from "@/server/auth/require-user";

export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await params;
    const user = await requireUser();
    const body = (await request.json()) as {
      message?: string;
      mode?: "room" | "meeting_guest";
      agentId?: string;
      guestSourceRoomId?: string;
      inputMessageId?: string;
    };
    const result = await startAgentRun({
      userId: user.userId,
      roomId,
      message: body.message?.trim() || "도움이 필요합니다.",
      inputMessageId: body.inputMessageId ?? null,
      mode: body.mode ?? "room",
      agentId: body.agentId,
      guestSourceRoomId: body.guestSourceRoomId ?? null,
    });

    after(async () => {
      try {
        await completeAgentRun(result.job);
      } catch (error) {
        console.error("Failed to complete agent run", { runId: result.run.id, error });
      }
    });

    return jsonOk({ run: result.run, inputMessage: result.inputMessage }, { status: 202 });
  } catch (error) {
    return jsonError(error);
  }
}
