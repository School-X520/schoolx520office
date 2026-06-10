import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { isAuthDebugEnabled } from "@/lib/env";
import { getSupabaseProjectRef, isCurrentSupabaseAuthCookie } from "@/lib/supabase/auth-cookies";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readAppSessionUser } from "@/server/auth/app-session";
import { getCurrentUser } from "@/server/auth/get-current-user";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AuthStatusPage() {
  if (!isAuthDebugEnabled()) {
    notFound();
  }

  const cookieStore = await cookies();
  const cookieNames = cookieStore.getAll().map((cookie) => cookie.name).sort();
  const supabaseCookieNames = cookieNames.filter((name) => name.startsWith("sb-"));
  const currentProjectCookieNames = supabaseCookieNames.filter(isCurrentSupabaseAuthCookie);
  const appSessionUser = await readAppSessionUser().catch(() => null);
  const currentUser = await getCurrentUser().catch(() => null);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: supabaseUser },
    error,
  } = await supabase.auth.getUser();

  const rows = [
    ["currentProjectRef", getSupabaseProjectRef()],
    ["hasCurrentUser", Boolean(currentUser)],
    ["currentUserEmail", currentUser?.email ?? null],
    ["hasAppSession", Boolean(appSessionUser)],
    ["appSessionEmail", appSessionUser?.email ?? null],
    ["hasSupabaseUser", Boolean(supabaseUser)],
    ["supabaseEmail", supabaseUser?.email ?? null],
    ["supabaseAuthError", error?.message ?? null],
    ["currentProjectCookieNames", currentProjectCookieNames.join(", ") || "(none)"],
    ["allCookieNames", cookieNames.join(", ") || "(none)"],
  ] as const;

  return (
    <main className="min-h-dvh bg-paper px-6 py-8 text-ink">
      <div className="mx-auto max-w-3xl rounded-lg border border-line bg-card p-5 shadow-sm">
        <h1 className="text-xl font-semibold">Auth Status</h1>
        <dl className="mt-5 divide-y divide-line text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="grid gap-2 py-3 md:grid-cols-[220px_1fr]">
              <dt className="font-medium text-ink-soft">{label}</dt>
              <dd className="break-all font-mono">{String(value)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </main>
  );
}
