import "server-only";

import { shouldUseMockData } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
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

export async function getCurrentUser(): Promise<UserProfile | null> {
  if (shouldUseMockData()) {
    return mockStore.currentUser();
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return null;
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return null;
  }

  const { data } = await (admin as unknown as LooseSupabase)
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) {
    return {
      userId: user.id,
      email: user.email,
      displayName: user.user_metadata?.name ?? user.email,
      avatarUrl: user.user_metadata?.avatar_url ?? null,
      isAdmin: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    userId: String(data.user_id),
    email: String(data.email),
    displayName: String(data.display_name ?? data.email),
    avatarUrl: data.avatar_url ? String(data.avatar_url) : null,
    isAdmin: Boolean(data.is_admin),
    createdAt: String(data.created_at),
    updatedAt: String(data.updated_at),
  };
}
