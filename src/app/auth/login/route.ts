import { NextResponse, type NextRequest } from "next/server";

import { shouldUseMockData } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  if (shouldUseMockData()) {
    return NextResponse.redirect(new URL("/office", request.url));
  }

  const supabase = await createSupabaseServerClient();
  const redirectTo = new URL("/auth/callback", request.url).toString();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });

  if (error || !data.url) {
    return NextResponse.redirect(new URL("/login?error=oauth", request.url));
  }

  return NextResponse.redirect(data.url);
}
