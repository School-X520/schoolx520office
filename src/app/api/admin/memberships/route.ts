import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { parseJsonBody } from "@/lib/parse-json-body";
import { shouldUseMockData } from "@/lib/env";
import { requireAdmin } from "@/server/auth/require-user";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";

const membershipBodySchema = z.object({
  action: z.string().max(64).optional(),
  roomId: z.string().max(64).optional(),
  roomIds: z.array(z.string().max(64)).max(20).optional(),
  targetUserId: z.string().max(256).optional(),
  role: z.enum(["admin", "member", "observer"]).optional(),
});

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
    const body = await parseJsonBody(request, membershipBodySchema);
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
    const pendingEmail = pendingEmailFromTarget(body.targetUserId);
    const resolvedProfile =
      pendingEmail && !shouldUseMockData() ? await supabaseStore.getUserProfileByEmail(pendingEmail) : null;
    const targetUserId = resolvedProfile?.userId ?? (pendingEmail ? null : body.targetUserId);

    if (pendingEmail) {
      const allowedUser = shouldUseMockData()
        ? mockStore.getAllowedUser(pendingEmail)
        : await supabaseStore.getAllowedUser(pendingEmail);
      if (!allowedUser?.isActive) {
        return jsonOk({ ok: false, message: "활성 승인 사용자를 찾을 수 없습니다." }, { status: 404 });
      }
    }

    const memberships = [];
    for (const roomId of roomIds) {
      if (action === "membership.removed") {
        if (pendingEmail && !targetUserId) {
          if (shouldUseMockData()) {
            mockStore.deletePendingRoomMembership({ email: pendingEmail, roomId });
          } else {
            await supabaseStore.deletePendingRoomMembership({ email: pendingEmail, roomId, deletedBy: user.userId });
          }
        } else if (targetUserId && shouldUseMockData()) {
          mockStore.deleteMembership({ userId: targetUserId, roomId });
        } else {
          await supabaseStore.deleteMembership({ userId: targetUserId!, roomId });
        }
      } else {
        const membership = pendingEmail && !targetUserId
          ? shouldUseMockData()
            ? mockStore.upsertPendingRoomMembership({
                email: pendingEmail,
                roomId,
                role: body.role ?? "member",
                assignedBy: user.userId,
              })
            : await supabaseStore.upsertPendingRoomMembership({
                email: pendingEmail,
                roomId,
                role: body.role ?? "member",
                assignedBy: user.userId,
              })
          : shouldUseMockData()
            ? mockStore.upsertMembership({
                userId: targetUserId!,
                roomId,
                role: body.role ?? "member",
              })
            : await supabaseStore.upsertMembership({
                userId: targetUserId!,
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
        targetId: targetUserId ?? pendingEmail ?? body.targetUserId,
        metadata: { role: body.role ?? "member", pendingEmail, mockOnly: shouldUseMockData() },
      });
    }
    return jsonOk({ ok: true, memberships });
  } catch (error) {
    return jsonError(error);
  }
}

function pendingEmailFromTarget(targetUserId: string) {
  return targetUserId.startsWith("email:") ? targetUserId.slice("email:".length).trim().toLowerCase() : "";
}
