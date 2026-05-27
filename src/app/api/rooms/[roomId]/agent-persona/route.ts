import { jsonError, jsonOk } from "@/lib/api";
import { getRoomAgentPersona, saveRoomAgentPersonaDraft } from "@/server/agents/agent-persona-service";
import { requireUser } from "@/server/auth/require-user";

export async function GET(_: Request, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await params;
    const user = await requireUser();
    const result = await getRoomAgentPersona(user.userId, roomId);
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await params;
    const user = await requireUser();
    const body = (await request.json().catch(() => ({}))) as { persona?: unknown };
    const result = await saveRoomAgentPersonaDraft(user.userId, roomId, body.persona);
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
