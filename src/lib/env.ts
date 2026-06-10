import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  NEXT_PUBLIC_ENABLE_ZOOM_EMBED: z
    .enum(["true", "false"])
    .optional()
    .default("false"),
});

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_BETA_HEADER: z.string().optional().default("managed-agents-2026-04-01"),
  APP_URL: z.string().url().optional().default("http://localhost:3000"),
  ENABLE_REAL_AGENTS: z.enum(["true", "false"]).optional().default("false"),
  ALL_ROOM_ACCESS_EMAILS: z.string().optional().default(""),
  GOOGLE_MEET_ENABLED: z.enum(["true", "false"]).optional().default("false"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),
  GOOGLE_MEET_ACCESS_TOKEN: z.string().optional(),
  ZOOM_ENABLED: z.enum(["true", "false"]).optional().default("false"),
  ZOOM_CLIENT_ID: z.string().optional(),
  ZOOM_CLIENT_SECRET: z.string().optional(),
  ZOOM_ACCOUNT_ID: z.string().optional(),
  ZOOM_MEETING_SDK_KEY: z.string().optional(),
  ZOOM_MEETING_SDK_SECRET: z.string().optional(),
});

export function getPublicEnv() {
  return publicEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_ENABLE_ZOOM_EMBED: process.env.NEXT_PUBLIC_ENABLE_ZOOM_EMBED,
  });
}

export function getServerEnv() {
  return serverEnvSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    ANTHROPIC_BETA_HEADER: process.env.ANTHROPIC_BETA_HEADER,
    APP_URL: process.env.APP_URL,
    ENABLE_REAL_AGENTS: process.env.ENABLE_REAL_AGENTS,
    ALL_ROOM_ACCESS_EMAILS: process.env.ALL_ROOM_ACCESS_EMAILS,
    GOOGLE_MEET_ENABLED: process.env.GOOGLE_MEET_ENABLED,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
    GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN,
    GOOGLE_MEET_ACCESS_TOKEN: process.env.GOOGLE_MEET_ACCESS_TOKEN,
    ZOOM_ENABLED: process.env.ZOOM_ENABLED,
    ZOOM_CLIENT_ID: process.env.ZOOM_CLIENT_ID,
    ZOOM_CLIENT_SECRET: process.env.ZOOM_CLIENT_SECRET,
    ZOOM_ACCOUNT_ID: process.env.ZOOM_ACCOUNT_ID,
    ZOOM_MEETING_SDK_KEY: process.env.ZOOM_MEETING_SDK_KEY,
    ZOOM_MEETING_SDK_SECRET: process.env.ZOOM_MEETING_SDK_SECRET,
  });
}

export function isSupabaseConfigured() {
  const env = getPublicEnv();
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function isServiceRoleConfigured() {
  return isSupabaseConfigured() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// next build 단계(NEXT_PHASE=phase-production-build)는 프로덕션 런타임으로 취급하지 않는다 —
// 빌드는 env 없이도 가능해야 하고, 가드는 실제 요청 처리 시점에만 작동해야 한다.
function isProductionRuntime() {
  return process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build";
}

export function shouldUseMockData() {
  const explicitMock = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";
  if (isProductionRuntime()) {
    if (explicitMock) {
      throw new Error(
        "NEXT_PUBLIC_USE_MOCK_DATA=true는 프로덕션 런타임에서 허용되지 않습니다. 변수를 제거하거나 false로 설정하세요.",
      );
    }
    if (!isServiceRoleConfigured()) {
      throw new Error(
        "프로덕션 런타임에 Supabase 환경 변수(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)가 누락되었습니다. mock 모드로 폴백하지 않습니다.",
      );
    }
    return false;
  }
  return explicitMock || !isServiceRoleConfigured();
}

export function isAuthDebugEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.ENABLE_AUTH_DEBUG === "true";
}

export function assertProductionEnv() {
  if (!isProductionRuntime()) {
    return;
  }

  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!process.env.APP_SESSION_SECRET) missing.push("APP_SESSION_SECRET");
  if (process.env.ENABLE_REAL_AGENTS === "true" && !process.env.ANTHROPIC_API_KEY) {
    missing.push("ANTHROPIC_API_KEY(ENABLE_REAL_AGENTS=true)");
  }

  const forbidden: string[] = [];
  if (process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true") {
    forbidden.push("NEXT_PUBLIC_USE_MOCK_DATA=true");
  }

  if (missing.length > 0 || forbidden.length > 0) {
    const parts = [
      missing.length > 0 ? `누락: ${missing.join(", ")}` : null,
      forbidden.length > 0 ? `금지: ${forbidden.join(", ")}` : null,
    ].filter(Boolean);
    throw new Error(`[env] 프로덕션 환경 변수 검증 실패 — ${parts.join(" / ")}`);
  }
}

export function missingSetupMessage(scope: string) {
  return `${scope} 설정이 아직 비어 있습니다. .env.local과 docs/SETUP.md를 채운 뒤 real mode를 켜세요.`;
}
