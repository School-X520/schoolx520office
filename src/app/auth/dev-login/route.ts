import { NextResponse, type NextRequest } from "next/server";

import { clearCurrentSupabaseAuthCookies } from "@/lib/supabase/auth-cookies";
import { setAppSessionCookie } from "@/server/auth/app-session";
import { getDevLoginEmail, isDevLoginEnabledForHost } from "@/server/auth/dev-login";
import { supabaseStore } from "@/server/data/supabase-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isDevLoginEnabledForHost(request.headers.get("host"))) {
    return NextResponse.redirect(new URL("/login?error=dev-login-disabled", request.url));
  }

  const email = getDevLoginEmail();
  const [allowedUser, profile] = await Promise.all([
    supabaseStore.getAllowedUser(email),
    supabaseStore.getUserProfileByEmail(email),
  ]);

  if (!allowedUser?.isActive || !profile) {
    return NextResponse.redirect(new URL("/login?error=dev-login-unavailable", request.url));
  }

  const response = NextResponse.redirect(new URL("/office", request.url));
  clearCurrentSupabaseAuthCookies(response);
  setAppSessionCookie(response, {
    userId: profile.userId,
    email: profile.email,
  });
  return response;
}
