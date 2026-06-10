import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

const APP_SESSION_COOKIE = "schoolx-app-session";
const APP_SESSION_MAX_AGE = 7 * 24 * 60 * 60;

export type AppSessionUser = {
  userId: string;
  email: string;
};

type AppSessionPayload = AppSessionUser & {
  expiresAt: number;
};

export async function readAppSessionUser(): Promise<AppSessionUser | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(APP_SESSION_COOKIE)?.value;
  if (!value) {
    return null;
  }

  const payload = verifyAppSession(value);
  if (!payload || payload.expiresAt < Date.now()) {
    return null;
  }

  return {
    userId: payload.userId,
    email: payload.email,
  };
}

export function setAppSessionCookie(response: NextResponse, user: AppSessionUser) {
  response.cookies.set(APP_SESSION_COOKIE, signAppSession(user), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: APP_SESSION_MAX_AGE,
  });
}

export function clearAppSessionCookie(response: NextResponse) {
  response.cookies.set(APP_SESSION_COOKIE, "", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
}

function signAppSession(user: AppSessionUser) {
  const payload: AppSessionPayload = {
    ...user,
    email: user.email.trim().toLowerCase(),
    expiresAt: Date.now() + APP_SESSION_MAX_AGE * 1000,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

function verifyAppSession(value: string): AppSessionPayload | null {
  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expected = sign(encodedPayload);
  if (!safeEqual(signature, expected)) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<AppSessionPayload>;
    if (!decoded.userId || !decoded.email || typeof decoded.expiresAt !== "number") {
      return null;
    }
    return {
      userId: decoded.userId,
      email: decoded.email.trim().toLowerCase(),
      expiresAt: decoded.expiresAt,
    };
  } catch {
    return null;
  }
}

function sign(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

// 세션 서명 키는 DB 마스터 키와 분리되어야 한다 — service role 키 폴백은
// 키 회전을 세션 무효화와 결합시키고 최고 권한 키의 노출 표면을 넓히므로
// 프로덕션에서는 허용하지 않는다.
export function resolveAppSessionSecret(env: {
  APP_SESSION_SECRET?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  NODE_ENV?: string;
}) {
  const secret = env.APP_SESSION_SECRET?.trim();
  if (secret) {
    return { secret, usingFallback: false };
  }
  if (env.NODE_ENV === "production") {
    throw new Error(
      "APP_SESSION_SECRET이 설정되지 않았습니다. 프로덕션에서는 SUPABASE_SERVICE_ROLE_KEY 폴백을 허용하지 않습니다. `openssl rand -base64 32` 값을 APP_SESSION_SECRET으로 설정하세요.",
    );
  }
  const fallback = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!fallback) {
    throw new Error("APP_SESSION_SECRET이 필요합니다. .env.local에 추가하세요.");
  }
  return { secret: fallback, usingFallback: true };
}

let warnedDevSecretFallback = false;

function getSessionSecret() {
  const { secret, usingFallback } = resolveAppSessionSecret(process.env);
  if (usingFallback && !warnedDevSecretFallback) {
    warnedDevSecretFallback = true;
    console.warn(
      "[app-session] APP_SESSION_SECRET 미설정 — 개발 환경 한정으로 service role 키로 폴백합니다. .env.local에 APP_SESSION_SECRET을 추가하세요.",
    );
  }
  return secret;
}
