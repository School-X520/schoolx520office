import { cookies } from "next/headers";

import { jsonOk } from "@/lib/api";
import { shouldUseMockData } from "@/lib/env";
import { getSupabaseProjectRef, isCurrentSupabaseAuthCookie } from "@/lib/supabase/auth-cookies";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readAppSessionUser } from "@/server/auth/app-session";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const supabaseCookieNames = cookieStore
    .getAll()
    .map((cookie) => cookie.name)
    .filter((name) => name.startsWith("sb-"))
    .sort();
  const currentProjectCookieNames = supabaseCookieNames.filter(isCurrentSupabaseAuthCookie);
  const otherSupabaseCookieNames = supabaseCookieNames.filter((name) => !isCurrentSupabaseAuthCookie(name));
  const appSessionUser = await readAppSessionUser().catch(() => null);

  if (shouldUseMockData()) {
    return jsonOk(
      {
        mode: "mock",
        hasSupabaseUser: true,
        email: "mock@example.com",
        currentProjectRef: getSupabaseProjectRef(),
        currentProjectCookieNames,
        otherSupabaseCookieNames,
        hasCurrentAuthTokenCookie: currentProjectCookieNames.some((name) => name.includes("-auth-token")),
        hasCurrentCodeVerifierCookie: currentProjectCookieNames.some((name) => name.endsWith("-code-verifier")),
        supabaseCookieCount: supabaseCookieNames.length,
        supabaseCookieNames,
        authError: null,
        hasAppSession: Boolean(appSessionUser),
        appSessionEmail: appSessionUser?.email ?? null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return jsonOk(
    {
      mode: "supabase",
      hasSupabaseUser: Boolean(user),
      email: user?.email ?? null,
      currentProjectRef: getSupabaseProjectRef(),
      currentProjectCookieNames,
      otherSupabaseCookieNames,
      hasCurrentAuthTokenCookie: currentProjectCookieNames.some((name) => name.includes("-auth-token")),
      hasCurrentCodeVerifierCookie: currentProjectCookieNames.some((name) => name.endsWith("-code-verifier")),
      supabaseCookieCount: supabaseCookieNames.length,
      supabaseCookieNames,
      authError: error?.message ?? null,
      hasAppSession: Boolean(appSessionUser),
      appSessionEmail: appSessionUser?.email ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
