import "server-only";

import { AuthError, ForbiddenError } from "@/server/auth/errors";
import { getCurrentUser } from "@/server/auth/get-current-user";

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError("로그인이 필요합니다.");
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!user.isAdmin) {
    throw new ForbiddenError("관리자 권한이 필요합니다.");
  }
  return user;
}
