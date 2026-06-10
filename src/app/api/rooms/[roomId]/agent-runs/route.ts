import { after } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { parseJsonBody } from "@/lib/parse-json-body";
import { completeAgentRun, startAgentRun } from "@/server/agents/run-agent";
import { requireUser } from "@/server/auth/require-user";

export const maxDuration = 60;

const agentRunBodySchema = z.object({
  message: z.string().max(8000).optional(),
  mode: z.enum(["room", "meeting_guest"]).optional(),
  threadId: z.string().max(128).optional(),
  agentId: z.string().max(64).optional(),
  guestSourceRoomId: z.string().max(64).optional(),
  inputMessageId: z.string().max(128).optional(),
  intent: z.enum(["development_request"]).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await params;
    const user = await requireUser();
    const body = await parseJsonBody(request, agentRunBodySchema);
    const result = await startAgentRun({
      userId: user.userId,
      roomId,
      threadId: body.threadId ?? null,
      message: body.message?.trim() || "도움이 필요합니다.",
      inputMessageId: body.inputMessageId ?? null,
      mode: body.mode ?? "room",
      agentId: body.agentId,
      guestSourceRoomId: body.guestSourceRoomId ?? null,
      intent: body.intent ?? null,
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
