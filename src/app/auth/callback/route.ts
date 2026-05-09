import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { shouldUseMockData } from "@/lib/env";
import { clearCurrentSupabaseAuthCookies } from "@/lib/supabase/auth-cookies";
import { supabaseStore } from "@/server/data/supabase-store";

type OAuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
};

function metadataText(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}

function redirectWithCookies(
  request: NextRequest,
  path: string,
  cookiesToSet: {
    name: string;
    value: string;
    options?: Parameters<NextResponse["cookies"]["set"]>[2];
  }[],
  clearStaleAuthCookies = false,
) {
  const response = NextResponse.redirect(new URL(path, request.url));
  if (clearStaleAuthCookies) {
    clearCurrentSupabaseAuthCookies(response);
  }
  cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  return response;
}

async function onboardApprovedUser(user: OAuthUser) {
  const email = user.email?.trim().toLowerCase();
  if (!email) {
    return false;
  }

  const allowedUser = await supabaseStore.getAllowedUser(email);
  if (!allowedUser?.isActive) {
    return false;
  }

  const displayName =
    metadataText(user.user_metadata, "name") ??
    metadataText(user.user_metadata, "full_name") ??
    email.split("@")[0];

  await supabaseStore.ensureUserProfile({
    userId: user.id,
    email,
    displayName,
    avatarUrl: metadataText(user.user_metadata, "avatar_url"),
    isAdmin: Boolean(allowedUser.isAdmin),
  });
  if (allowedUser.isAdmin) {
    await supabaseStore.grantAllRoomMemberships(user.id, "admin");
  } else {
    await supabaseStore.upsertMembership({
      userId: user.id,
      roomId: "meeting",
      role: "member",
    });
  }

  return true;
}

export async function GET(request: NextRequest) {
  if (shouldUseMockData() || request.nextUrl.searchParams.get("mock") === "1") {
    return NextResponse.redirect(new URL("/office", request.url));
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL("/login?error=oauth", request.url));
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
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
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        responseCookies.push(...cookiesToSet);
      },
    },
  });
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session) {
    if (error) {
      console.warn("[auth/callback] Supabase OAuth exchange failed:", error.message);
    }
    return redirectWithCookies(request, "/login?error=oauth", responseCookies, true);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const approved = user ? await onboardApprovedUser(user) : false;
  if (!approved) {
    await supabase.auth.signOut();
    return redirectWithCookies(request, "/login?error=not-approved", responseCookies, true);
  }

  return redirectWithCookies(request, "/office", responseCookies, true);
}
