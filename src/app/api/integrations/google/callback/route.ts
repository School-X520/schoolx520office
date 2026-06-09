import { NextResponse, type NextRequest } from "next/server";

import { shouldUseMockData } from "@/lib/env";
import { writeAuditLog } from "@/server/audit/audit-service";
import { AuthError, ForbiddenError } from "@/server/auth/errors";
import { requireAdmin } from "@/server/auth/require-user";
import { supabaseStore } from "@/server/data/supabase-store";
import { exchangeGoogleMeetOAuthCode, GOOGLE_MEET_OAUTH_STATE_COOKIE } from "@/server/integrations/google-oauth";

function redirectWithClearedState(request: NextRequest, path: string) {
  const response = NextResponse.redirect(new URL(path, request.url));
  response.cookies.set(GOOGLE_MEET_OAUTH_STATE_COOKIE, "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
  });
  return response;
}

export async function GET(request: NextRequest) {
  if (shouldUseMockData()) {
    return redirectWithClearedState(request, "/admin/ops?google=mock-mode");
  }

  let user;
  try {
    user = await requireAdmin();
  } catch (error) {
    if (error instanceof AuthError) {
      return redirectWithClearedState(request, "/login");
    }
    if (error instanceof ForbiddenError) {
      return redirectWithClearedState(request, "/office");
    }
    throw error;
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(GOOGLE_MEET_OAUTH_STATE_COOKIE)?.value;
  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectWithClearedState(request, "/admin/ops?google=state-mismatch");
  }

  try {
    const tokens = await exchangeGoogleMeetOAuthCode(code);
    if (!tokens.refreshToken) {
      return redirectWithClearedState(request, "/admin/ops?google=missing-refresh-token");
    }

    const expiresAt = tokens.expiresIn ? new Date(Date.now() + tokens.expiresIn * 1000).toISOString() : null;
    await supabaseStore.upsertIntegrationToken({
      provider: "google_meet",
      refreshToken: tokens.refreshToken,
      accessToken: null,
      expiresAt,
      scope: tokens.scope,
      tokenType: tokens.tokenType,
      connectedBy: user.userId,
      metadata: { source: "admin_google_oauth" },
    });
    await writeAuditLog({
      actorUserId: user.userId,
      action: "integration.google_meet.connected",
      targetType: "integration",
      targetId: "google_meet",
      metadata: { scope: tokens.scope, expiresAt },
    });
    return redirectWithClearedState(request, "/admin/ops?google=connected");
  } catch (error) {
    console.warn("[google-oauth] callback failed:", error instanceof Error ? error.message : error);
    return redirectWithClearedState(request, "/admin/ops?google=failed");
  }
}
