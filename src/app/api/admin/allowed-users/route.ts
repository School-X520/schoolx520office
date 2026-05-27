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
        : body.isAdmin
          ? "허용 사용자 목록에 저장하고 관리자 권한을 부여했습니다."
          : "허용 사용자 목록에 저장했습니다.",
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAdmin();
    const body = (await request.json()) as {
      email?: string;
      isAdmin?: boolean;
      isActive?: boolean;
    };
    const email = body.email?.trim().toLowerCase();
    if (!email) {
      return jsonOk({ ok: false, message: "email이 필요합니다." }, { status: 400 });
    }
    const patch: { isAdmin?: boolean; isActive?: boolean } = {};
    if (typeof body.isAdmin === "boolean") {
      patch.isAdmin = body.isAdmin;
    }
    if (typeof body.isActive === "boolean") {
      patch.isActive = body.isActive;
    }
    if (!Object.keys(patch).length) {
      return jsonOk({ ok: false, message: "변경할 값이 필요합니다." }, { status: 400 });
    }
    if (email === user.email.toLowerCase() && (patch.isAdmin === false || patch.isActive === false)) {
      return jsonOk(
        { ok: false, message: "현재 로그인한 관리자의 active/admin 권한은 직접 끌 수 없습니다." },
        { status: 400 },
      );
    }

    const source = shouldUseMockData() ? mockStore : supabaseStore;
    const allowedUser = shouldUseMockData()
      ? mockStore.updateAllowedUser(email, patch)
      : await supabaseStore.updateAllowedUser(email, patch);
    if (!allowedUser) {
      return jsonOk({ ok: false, message: "승인 사용자를 찾을 수 없습니다." }, { status: 404 });
    }
    if (typeof patch.isAdmin === "boolean" && !shouldUseMockData()) {
      const profile = await supabaseStore.updateUserAdminByEmail(email, patch.isAdmin);
      if (profile && patch.isAdmin) {
        await supabaseStore.grantAllRoomMemberships(profile.userId, "admin");
      }
    }
    await source.addAuditLog({
      actorUserId: user.userId,
      action: "allowed_user.updated",
      targetType: "allowed_user",
      targetId: email,
      metadata: { ...patch, mockOnly: shouldUseMockData() },
    });
    return jsonOk({ ok: true, allowedUser });
  } catch (error) {
    return jsonError(error);
  }
}
