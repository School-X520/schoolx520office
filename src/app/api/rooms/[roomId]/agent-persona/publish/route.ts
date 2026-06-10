import { jsonError, jsonOk } from "@/lib/api";
import { statusError } from "@/lib/http-error";
import { personaPublishErrorMessage, publishRoomAgentPersona } from "@/server/agents/agent-persona-service";
import { requireUser } from "@/server/auth/require-user";

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await params;
    const user = await requireUser();
    const body = (await request.json().catch(() => ({}))) as { persona?: unknown };
    const result = await publishRoomAgentPersona(user.userId, roomId, body.persona);
    return jsonOk(result);
  } catch (error) {
    const message = personaPublishErrorMessage(error);
    const status = error instanceof Error && "status" in error && typeof error.status === "number" ? error.status : 500;
    return jsonError(statusError(message, status));
  }
}
