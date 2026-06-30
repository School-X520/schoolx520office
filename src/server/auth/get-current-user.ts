import "server-only";

import { cache } from "react";

import { shouldUseMockData } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { readAppSessionUser } from "@/server/auth/app-session";
import { mockStore } from "@/server/data/mock-store";
import type { UserProfile } from "@/types/domain";

type LooseQuery = {
  select: (columns: string) => LooseQuery;
  eq: (column: string, value: string) => LooseQuery;
  maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>;
};

type LooseSupabase = {
  from: (table: string) => LooseQuery;
};

// 한 요청에서 layout·page·라우트 핸들러가 getCurrentUser를 여러 번 호출해도
// 인증 체인(세션 검증 + allowed_users/user_profiles 조회)을 1회만 수행하도록 요청 단위로 메모이즈한다.
export const getCurrentUser = cache(resolveCurrentUser);

async function resolveCurrentUser(): Promise<UserProfile | null> {
  if (shouldUseMockData()) {
    return mockStore.currentUser();
  }

  // 로컬 HMAC 앱 세션을 먼저 본다 — OAuth/dev 로그인 모두 콜백에서 이 쿠키를 굽고,
  // 서명 검증만으로(네트워크 0회) 사용자를 식별할 수 있다. 매 요청 Supabase Auth 서버
  // 왕복(getUser)을 제거하는 것이 버튼 체감 지연의 핵심 개선이다.
  const appSessionUser = await readAppSessionUser();
  if (appSessionUser) {
    return getUserProfile({
      userId: appSessionUser.userId,
      email: appSessionUser.email,
      displayName: appSessionUser.email,
      avatarUrl: null,
    });
  }

  // 앱 세션이 없을 때만(레거시/세션 쿠키 유실 등) Supabase Auth로 폴백한다(네트워크 왕복).
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.email) {
    return getUserProfile({
      userId: user.id,
      email: user.email,
      displayName: user.user_metadata?.name ?? user.email,
      avatarUrl: user.user_metadata?.avatar_url ?? null,
    });
  }

  return null;
}

async function getUserProfile({
  userId,
  email,
  displayName,
  avatarUrl,
}: {
  userId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
}): Promise<UserProfile | null> {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return null;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const { data: allowedUser } = await (admin as unknown as LooseSupabase)
    .from("allowed_users")
    .select("is_active,is_admin")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (!allowedUser?.is_active) {
    return null;
  }

  const { data } = await (admin as unknown as LooseSupabase)
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) {
    return {
      userId,
      email: normalizedEmail,
      displayName,
      avatarUrl,
      bio: null,
      isAdmin: Boolean(allowedUser.is_admin),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    userId: String(data.user_id),
    email: String(data.email),
    displayName: String(data.display_name ?? data.email),
    avatarUrl: data.avatar_url ? String(data.avatar_url) : null,
    bio: data.bio ? String(data.bio) : null,
    isAdmin: Boolean(data.is_admin) || Boolean(allowedUser.is_admin),
    createdAt: String(data.created_at),
    updatedAt: String(data.updated_at),
  };
}
