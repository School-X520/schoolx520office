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
      roomIds?: string[];
      targetUserId?: string;
      role?: RoomRole;
    };
    const roomIds = Array.from(
      new Set(
        (Array.isArray(body.roomIds) && body.roomIds.length ? body.roomIds : body.roomId ? [body.roomId] : [])
          .map((roomId) => roomId.trim())
          .filter(Boolean),
      ),
    );
    if (!roomIds.length || !body.targetUserId) {
      return jsonOk({ ok: false, message: "roomIds와 targetUserId가 필요합니다." }, { status: 400 });
    }
    const source = shouldUseMockData() ? mockStore : supabaseStore;
    const action = body.action ?? "membership.updated";
    const memberships = [];
    for (const roomId of roomIds) {
      if (action === "membership.removed") {
        if (shouldUseMockData()) {
          mockStore.deleteMembership({ userId: body.targetUserId, roomId });
        } else {
          await supabaseStore.deleteMembership({ userId: body.targetUserId, roomId });
        }
      } else {
        const membership = shouldUseMockData()
          ? mockStore.upsertMembership({
              userId: body.targetUserId,
              roomId,
              role: body.role ?? "member",
            })
          : await supabaseStore.upsertMembership({
              userId: body.targetUserId,
              roomId,
              role: body.role ?? "member",
            });
        memberships.push(membership);
      }
      await source.addAuditLog({
        actorUserId: user.userId,
        roomId,
        action,
        targetType: "room_membership",
        targetId: body.targetUserId,
        metadata: { role: body.role ?? "member", mockOnly: shouldUseMockData() },
      });
    }
    return jsonOk({ ok: true, memberships });
  } catch (error) {
    return jsonError(error);
  }
}
