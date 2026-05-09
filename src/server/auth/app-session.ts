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
    maxAge: APP_SESSION_MAX_AGE,
  });
}

export function clearAppSessionCookie(response: NextResponse) {
  response.cookies.set(APP_SESSION_COOKIE, "", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
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

function getSessionSecret() {
  const secret = process.env.APP_SESSION_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error("APP_SESSION_SECRET 또는 SUPABASE_SERVICE_ROLE_KEY가 필요합니다.");
  }
  return secret;
}
