import "server-only";

import { getServerEnv, shouldUseMockData } from "@/lib/env";
import { supabaseStore } from "@/server/data/supabase-store";

export const GOOGLE_MEET_SCOPES = [
  "https://www.googleapis.com/auth/meetings.space.created",
  "https://www.googleapis.com/auth/meetings.space.readonly",
];
export const GOOGLE_MEET_OAUTH_STATE_COOKIE = "schoolx_google_meet_oauth_state";

type GoogleTokenResponse = {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  scope?: unknown;
  token_type?: unknown;
};

export type GoogleOAuthTokens = {
  accessToken: string;
  refreshToken?: string | null;
  expiresIn?: number | null;
  scope?: string | null;
  tokenType?: string | null;
};

function googleOAuthConfig() {
  const env = getServerEnv();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
    return null;
  }
  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: env.GOOGLE_REDIRECT_URI,
  };
}

export function isGoogleOAuthConfigured() {
  return Boolean(googleOAuthConfig());
}

export function buildGoogleMeetOAuthUrl(state: string) {
  const config = googleOAuthConfig();
  if (!config) {
    return null;
  }

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_MEET_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return url;
}

function parseGoogleTokenResponse(body: GoogleTokenResponse): GoogleOAuthTokens | null {
  if (typeof body.access_token !== "string" || !body.access_token) {
    return null;
  }

  return {
    accessToken: body.access_token,
    refreshToken: typeof body.refresh_token === "string" ? body.refresh_token : null,
    expiresIn: typeof body.expires_in === "number" ? body.expires_in : null,
    scope: typeof body.scope === "string" ? body.scope : null,
    tokenType: typeof body.token_type === "string" ? body.token_type : null,
  };
}

async function postGoogleTokenRequest(params: URLSearchParams) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const body = (await response.json().catch(() => ({}))) as GoogleTokenResponse;
  if (!response.ok) {
    throw new Error("Google OAuth 토큰 요청에 실패했습니다.");
  }
  const tokens = parseGoogleTokenResponse(body);
  if (!tokens) {
    throw new Error("Google OAuth 응답에 access token이 없습니다.");
  }
  return tokens;
}

export async function exchangeGoogleMeetOAuthCode(code: string) {
  const config = googleOAuthConfig();
  if (!config) {
    throw new Error("Google OAuth 설정이 비어 있습니다.");
  }

  return postGoogleTokenRequest(
    new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
  );
}

async function refreshGoogleAccessToken(refreshToken: string) {
  const config = googleOAuthConfig();
  if (!config) {
    return null;
  }

  try {
    const tokens = await postGoogleTokenRequest(
      new URLSearchParams({
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "refresh_token",
      }),
    );
    return tokens.accessToken;
  } catch (error) {
    console.warn("[google-oauth] access token refresh failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

async function getStoredGoogleRefreshToken() {
  if (shouldUseMockData()) {
    return null;
  }

  try {
    const token = await supabaseStore.getIntegrationToken("google_meet");
    return token?.refreshToken ?? null;
  } catch (error) {
    console.warn("[google-oauth] stored refresh token unavailable:", error instanceof Error ? error.message : error);
    return null;
  }
}

export async function getGoogleMeetAccessToken() {
  const env = getServerEnv();
  if (env.GOOGLE_MEET_ACCESS_TOKEN) {
    return env.GOOGLE_MEET_ACCESS_TOKEN;
  }

  const refreshToken = env.GOOGLE_REFRESH_TOKEN ?? (await getStoredGoogleRefreshToken());
  if (!refreshToken) {
    return null;
  }

  return refreshGoogleAccessToken(refreshToken);
}
