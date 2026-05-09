import { jsonError, jsonOk } from "@/lib/api";
import { requireAdmin } from "@/server/auth/require-user";
import { mockStore } from "@/server/data/mock-store";

export async function GET() {
  try {
    await requireAdmin();
    return jsonOk({ memberships: mockStore.listMemberships() });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdmin();
    const body = (await request.json()) as { action?: string; roomId?: string; targetUserId?: string };
    mockStore.addAuditLog({
      actorUserId: user.userId,
      roomId: body.roomId ?? null,
      action: body.action ?? "membership.updated",
      targetType: "room_membership",
      targetId: body.targetUserId,
      metadata: { mockOnly: true },
    });
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
