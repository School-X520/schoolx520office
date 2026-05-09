import { NextResponse, type NextRequest } from "next/server";

import { shouldUseMockData } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
  await supabaseStore.upsertMembership({
    userId: user.id,
    roomId: "meeting",
    role: allowedUser.isAdmin ? "admin" : "member",
  });

  return true;
}

export async function GET(request: NextRequest) {
  if (shouldUseMockData() || request.nextUrl.searchParams.get("mock") === "1") {
    return NextResponse.redirect(new URL("/office", request.url));
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=oauth", request.url));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login?error=oauth", request.url));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const approved = user ? await onboardApprovedUser(user) : false;
  if (!approved) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=not-approved", request.url));
  }

  return NextResponse.redirect(new URL("/office", request.url));
}
