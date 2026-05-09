import { jsonError, jsonOk } from "@/lib/api";
import { requireAdmin } from "@/server/auth/require-user";
import { mockStore } from "@/server/data/mock-store";

export async function GET() {
  try {
    await requireAdmin();
    return jsonOk({ allowedUsers: mockStore.listAllowedUsers() });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdmin();
    const body = (await request.json()) as { email?: string; isAdmin?: boolean };
    mockStore.addAuditLog({
      actorUserId: user.userId,
      action: "user.invited",
      targetType: "allowed_user",
      targetId: body.email,
      metadata: { isAdmin: Boolean(body.isAdmin), mockOnly: true },
    });
    return jsonOk({ ok: true, message: "Mock mode에서는 audit log만 기록합니다." });
  } catch (error) {
    return jsonError(error);
  }
}
