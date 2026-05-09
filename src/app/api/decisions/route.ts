import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/server/auth/require-user";
import { requireRoomMember } from "@/server/auth/require-room-member";
import { mockStore } from "@/server/data/mock-store";

export async function GET(request: Request) {
  const roomId = new URL(request.url).searchParams.get("roomId") ?? undefined;
  return jsonOk({ decisions: mockStore.listDecisions(roomId) });
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as { roomId?: string; title?: string; description?: string };
    const roomId = body.roomId ?? "meeting";
    await requireRoomMember(user.userId, roomId);
    const decision = mockStore.createDecision({
      roomId,
      title: body.title ?? "새 결정사항",
      description: body.description ?? null,
      decidedBy: user.userId,
    });
    mockStore.addAuditLog({
      actorUserId: user.userId,
      roomId,
      action: "decision.created",
      targetType: "decision",
      targetId: decision.id,
    });
    return jsonOk({ decision });
  } catch (error) {
    return jsonError(error);
  }
}
