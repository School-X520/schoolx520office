import { jsonError, jsonOk } from "@/lib/api";
import { shouldUseMockData } from "@/lib/env";
import { requireAdmin } from "@/server/auth/require-user";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";
import type { RoomRole } from "@/types/domain";

export async function GET() {
  try {
    await requireAdmin();
    const source = shouldUseMockData() ? mockStore : supabaseStore;
    return jsonOk({ memberships: await source.listMemberships() });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdmin();
    const body = (await request.json()) as {
      action?: string;
      roomId?: string;
      targetUserId?: string;
      role?: RoomRole;
    };
    if (!body.roomId || !body.targetUserId) {
      return jsonOk({ ok: false, message: "roomId와 targetUserId가 필요합니다." }, { status: 400 });
    }
    const source = shouldUseMockData() ? mockStore : supabaseStore;
    const action = body.action ?? "membership.updated";
    const membership =
      shouldUseMockData() || action === "membership.removed"
        ? null
        : await supabaseStore.upsertMembership({
            userId: body.targetUserId,
            roomId: body.roomId,
            role: body.role ?? "member",
          });
    if (!shouldUseMockData() && action === "membership.removed") {
      await supabaseStore.deleteMembership({ userId: body.targetUserId, roomId: body.roomId });
    }
    await source.addAuditLog({
      actorUserId: user.userId,
      roomId: body.roomId,
      action,
      targetType: "room_membership",
      targetId: body.targetUserId,
      metadata: { role: body.role ?? "member", mockOnly: shouldUseMockData() },
    });
    return jsonOk({ ok: true, membership });
  } catch (error) {
    return jsonError(error);
  }
}
