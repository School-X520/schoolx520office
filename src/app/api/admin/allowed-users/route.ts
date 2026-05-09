import { jsonError, jsonOk } from "@/lib/api";
import { shouldUseMockData } from "@/lib/env";
import { requireAdmin } from "@/server/auth/require-user";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";

export async function GET() {
  try {
    await requireAdmin();
    const source = shouldUseMockData() ? mockStore : supabaseStore;
    return jsonOk({ allowedUsers: await source.listAllowedUsers() });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdmin();
    const body = (await request.json()) as { email?: string; isAdmin?: boolean; notes?: string; isActive?: boolean };
    const email = body.email?.trim().toLowerCase();
    if (!email) {
      return jsonOk({ ok: false, message: "email이 필요합니다." }, { status: 400 });
    }
    const source = shouldUseMockData() ? mockStore : supabaseStore;
    const allowedUser = shouldUseMockData()
      ? null
      : await supabaseStore.upsertAllowedUser({
          email,
          invitedBy: user.userId,
          notes: body.notes ?? null,
          isActive: body.isActive ?? true,
          isAdmin: Boolean(body.isAdmin),
        });
    if (!shouldUseMockData() && body.isAdmin) {
      const profile = await supabaseStore.updateUserAdminByEmail(email, true);
      if (profile) {
        await supabaseStore.grantAllRoomMemberships(profile.userId, "admin");
      }
    }
    await source.addAuditLog({
      actorUserId: user.userId,
      action: "user.invited",
      targetType: "allowed_user",
      targetId: email,
      metadata: { isAdmin: Boolean(body.isAdmin), mockOnly: shouldUseMockData() },
    });
    return jsonOk({
      ok: true,
      allowedUser,
      message: shouldUseMockData()
        ? "Mock mode에서는 audit log만 기록합니다."
        : "허용 사용자 목록에 저장했습니다. 관리자 권한은 사용자가 처음 로그인한 뒤 프로필에서 지정합니다.",
    });
  } catch (error) {
    return jsonError(error);
  }
}
