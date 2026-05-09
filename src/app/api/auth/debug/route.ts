import { cookies } from "next/headers";

import { jsonOk } from "@/lib/api";
import { shouldUseMockData } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const supabaseCookieNames = cookieStore
    .getAll()
    .map((cookie) => cookie.name)
    .filter((name) => name.startsWith("sb-"))
    .sort();

  if (shouldUseMockData()) {
    return jsonOk(
      {
        mode: "mock",
        hasSupabaseUser: true,
        email: "mock@example.com",
        supabaseCookieCount: supabaseCookieNames.length,
        supabaseCookieNames,
        authError: null,
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
      supabaseCookieCount: supabaseCookieNames.length,
      supabaseCookieNames,
      authError: error?.message ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
