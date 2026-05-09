import "server-only";

import type { NextResponse } from "next/server";

const AUTH_COOKIE_CHUNK_LIMIT = 8;

export function getSupabaseProjectRef() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return null;
  }

  try {
    return new URL(supabaseUrl).hostname.split(".")[0] || null;
  } catch {
    return null;
  }
}

export function getSupabaseAuthStorageKey() {
  const projectRef = getSupabaseProjectRef();
  return projectRef ? `sb-${projectRef}-auth-token` : null;
}

export function getSupabaseAuthCookieCandidates() {
  const storageKey = getSupabaseAuthStorageKey();
  if (!storageKey) {
    return [];
  }

  return [
    storageKey,
    ...Array.from({ length: AUTH_COOKIE_CHUNK_LIMIT }, (_, index) => `${storageKey}.${index}`),
    `${storageKey}-code-verifier`,
  ];
}

export function isCurrentSupabaseAuthCookie(name: string) {
  const storageKey = getSupabaseAuthStorageKey();
  return Boolean(storageKey && (name === storageKey || name.startsWith(`${storageKey}.`) || name === `${storageKey}-code-verifier`));
}

export function clearCurrentSupabaseAuthCookies(response: NextResponse) {
  getSupabaseAuthCookieCandidates().forEach((name) => {
    response.cookies.set(name, "", {
      path: "/",
      maxAge: 0,
      sameSite: "lax",
      httpOnly: false,
      secure: false,
    });
  });
}
