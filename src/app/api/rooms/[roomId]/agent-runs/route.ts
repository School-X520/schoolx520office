import { jsonError, jsonOk } from "@/lib/api";
import { runAgent } from "@/server/agents/run-agent";
import { requireUser } from "@/server/auth/require-user";

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await params;
    const user = await requireUser();
    const body = (await request.json()) as {
      message?: string;
      mode?: "room" | "meeting_guest";
      agentId?: string;
      guestSourceRoomId?: string;
    };
    const result = await runAgent({
      userId: user.userId,
      roomId,
      message: body.message?.trim() || "도움이 필요합니다.",
      mode: body.mode ?? "room",
      agentId: body.agentId,
      guestSourceRoomId: body.guestSourceRoomId ?? null,
    });
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
