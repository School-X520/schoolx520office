import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { shouldUseMockData } from "@/lib/env";
import { clearCurrentSupabaseAuthCookies } from "@/lib/supabase/auth-cookies";

function redirectWithCookies(
  request: NextRequest,
  target: string,
  cookiesToSet: {
    name: string;
    value: string;
    options?: Parameters<NextResponse["cookies"]["set"]>[2];
  }[],
  clearStaleAuthCookies = false,
) {
  const response = NextResponse.redirect(target.startsWith("http") ? target : new URL(target, request.url));
  if (clearStaleAuthCookies) {
    clearCurrentSupabaseAuthCookies(response);
  }
  cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  return response;
}

export async function GET(request: NextRequest) {
  if (shouldUseMockData()) {
    return NextResponse.redirect(new URL("/office", request.url));
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL("/login?error=oauth", request.url));
  }

  const responseCookies: {
    name: string;
    value: string;
    options?: Parameters<NextResponse["cookies"]["set"]>[2];
  }[] = [];
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        responseCookies.push(...cookiesToSet);
      },
    },
  });
  const redirectTo = new URL("/auth/callback", request.url).toString();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });

  if (error || !data.url) {
    return redirectWithCookies(request, "/login?error=oauth", responseCookies, true);
  }

  return redirectWithCookies(request, data.url, responseCookies, true);
}
