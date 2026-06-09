import { NextResponse, type NextRequest } from "next/server";

import { shouldUseMockData } from "@/lib/env";
import { AuthError, ForbiddenError } from "@/server/auth/errors";
import { requireAdmin } from "@/server/auth/require-user";
import { buildGoogleMeetOAuthUrl, GOOGLE_MEET_OAUTH_STATE_COOKIE } from "@/server/integrations/google-oauth";

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

function stateCookieOptions(request: NextRequest) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 10 * 60,
  };
}

export async function GET(request: NextRequest) {
  if (shouldUseMockData()) {
    return redirectTo(request, "/admin/ops?google=mock-mode");
  }

  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthError) {
      return redirectTo(request, "/login");
    }
    if (error instanceof ForbiddenError) {
      return redirectTo(request, "/office");
    }
    throw error;
  }

  const state = crypto.randomUUID();
  const url = buildGoogleMeetOAuthUrl(state);
  if (!url) {
    return redirectTo(request, "/admin/ops?google=setup-required");
  }

  const response = NextResponse.redirect(url);
  response.cookies.set(GOOGLE_MEET_OAUTH_STATE_COOKIE, state, stateCookieOptions(request));
  return response;
}
