import "server-only";

import type { NextResponse } from "next/server";

const AUTH_COOKIE_CHUNK_LIMIT = 8;
const AUTH_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;
const AUTH_COOKIE_CHUNK_SIZE = 3180;
const BASE64_PREFIX = "base64-";

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

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

export function hasCurrentSupabaseSessionCookie(cookiesToSet: CookieToSet[]) {
  const storageKey = getSupabaseAuthStorageKey();
  return Boolean(
    storageKey &&
      cookiesToSet.some(({ name, value }) => {
        if (!value) {
          return false;
        }
        return name === storageKey || name.startsWith(`${storageKey}.`);
      }),
  );
}

export function appendCurrentSupabaseSessionCookies(cookiesToSet: CookieToSet[], session: unknown) {
  const storageKey = getSupabaseAuthStorageKey();
  if (!storageKey || hasCurrentSupabaseSessionCookie(cookiesToSet)) {
    return;
  }

  const encodedSession = `${BASE64_PREFIX}${Buffer.from(JSON.stringify(session), "utf8").toString("base64url")}`;
  const chunks = chunkCookieValue(storageKey, encodedSession);

  cookiesToSet.push(
    ...chunks.map(({ name, value }) => ({
      name,
      value,
      options: {
        path: "/",
        sameSite: "lax" as const,
        httpOnly: false,
        maxAge: AUTH_COOKIE_MAX_AGE,
      },
    })),
  );
}

function chunkCookieValue(name: string, value: string) {
  if (encodeURIComponent(value).length <= AUTH_COOKIE_CHUNK_SIZE) {
    return [{ name, value }];
  }

  const chunks: { name: string; value: string }[] = [];
  for (let offset = 0; offset < value.length; offset += AUTH_COOKIE_CHUNK_SIZE) {
    chunks.push({
      name: `${name}.${chunks.length}`,
      value: value.slice(offset, offset + AUTH_COOKIE_CHUNK_SIZE),
    });
  }
  return chunks;
}
