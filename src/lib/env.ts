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
  GOOGLE_MEET_ENABLED: z.enum(["true", "false"]).optional().default("false"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
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
    GOOGLE_MEET_ENABLED: process.env.GOOGLE_MEET_ENABLED,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
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

export function shouldUseMockData() {
  return process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true" || !isSupabaseConfigured();
}

export function missingSetupMessage(scope: string) {
  return `${scope} 설정이 아직 비어 있습니다. .env.local과 docs/SETUP.md를 채운 뒤 real mode를 켜세요.`;
}
