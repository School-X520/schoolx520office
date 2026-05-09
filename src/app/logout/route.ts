import { NextResponse, type NextRequest } from "next/server";

import { shouldUseMockData } from "@/lib/env";
import { clearCurrentSupabaseAuthCookies } from "@/lib/supabase/auth-cookies";
import { clearAppSessionCookie } from "@/server/auth/app-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  if (!shouldUseMockData()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }

  const response = NextResponse.redirect(new URL("/login", request.url));
  clearCurrentSupabaseAuthCookies(response);
  clearAppSessionCookie(response);
  return response;
}
