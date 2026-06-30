import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const signOut = vi.fn();
  return {
    appendCurrentSupabaseSessionCookies: vi.fn(),
    clearAppSessionCookie: vi.fn(),
    clearCurrentSupabaseAuthCookies: vi.fn(),
    createServerClient: vi.fn(),
    createSupabaseServerClient: vi.fn(),
    getAllowedUser: vi.fn(),
    getServerEnv: vi.fn(() => ({ ALL_ROOM_ACCESS_EMAILS: "" })),
    getUserProfileByEmail: vi.fn(),
    grantAllRoomMemberships: vi.fn(),
    ensureUserProfile: vi.fn(),
    setAppSessionCookie: vi.fn(),
    shouldUseMockData: vi.fn(),
    signOut,
    upsertMembership: vi.fn(),
  };
});

vi.mock("@/lib/env", () => ({
  getServerEnv: mocks.getServerEnv,
  shouldUseMockData: mocks.shouldUseMockData,
}));

vi.mock("@/lib/supabase/auth-cookies", () => ({
  appendCurrentSupabaseSessionCookies: mocks.appendCurrentSupabaseSessionCookies,
  clearCurrentSupabaseAuthCookies: mocks.clearCurrentSupabaseAuthCookies,
}));

vi.mock("@/server/auth/app-session", () => ({
  clearAppSessionCookie: mocks.clearAppSessionCookie,
  setAppSessionCookie: mocks.setAppSessionCookie,
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

vi.mock("@/server/data/supabase-store", () => ({
  supabaseStore: {
    ensureUserProfile: mocks.ensureUserProfile,
    getAllowedUser: mocks.getAllowedUser,
    getUserProfileByEmail: mocks.getUserProfileByEmail,
    grantAllRoomMemberships: mocks.grantAllRoomMemberships,
    upsertMembership: mocks.upsertMembership,
  },
}));

const { GET: oauthLoginGET } = await import("@/app/auth/login/route");
const { GET: oauthCallbackGET } = await import("@/app/auth/callback/route");
const { GET: devLoginGET } = await import("@/app/auth/dev-login/route");
const { GET: logoutGET } = await import("@/app/logout/route");

function request(url: string, headers?: HeadersInit) {
  return new NextRequest(url, { headers });
}

function stubSupabaseEnv() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project-ref.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("OAuth auth routes", () => {
  it("starts Google OAuth with the callback URL when real auth is enabled", async () => {
    stubSupabaseEnv();
    mocks.shouldUseMockData.mockReturnValue(false);
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { url: "https://accounts.google.com/o/oauth2/v2/auth?client_id=test" },
      error: null,
    });
    mocks.createServerClient.mockReturnValue({ auth: { signInWithOAuth } });

    const response = await oauthLoginGET(request("http://localhost/auth/login"));

    expect(response.headers.get("location")).toBe("https://accounts.google.com/o/oauth2/v2/auth?client_id=test");
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "http://localhost/auth/callback" },
    });
    expect(mocks.clearCurrentSupabaseAuthCookies).toHaveBeenCalled();
    expect(mocks.clearAppSessionCookie).toHaveBeenCalled();
  });

  it("onboards an approved OAuth user and creates an app session", async () => {
    stubSupabaseEnv();
    mocks.shouldUseMockData.mockReturnValue(false);
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ data: { session: { access_token: "token" } }, error: null });
    const getUser = vi.fn().mockResolvedValue({
      data: {
        user: {
          id: "oauth-user-1",
          email: "Teacher@Example.com",
          user_metadata: { name: "OAuth Teacher", avatar_url: "https://example.com/avatar.png" },
        },
      },
    });
    mocks.createServerClient.mockReturnValue({ auth: { exchangeCodeForSession, getUser, signOut: mocks.signOut } });
    mocks.getAllowedUser.mockResolvedValue({ email: "teacher@example.com", isActive: true, isAdmin: false });

    const response = await oauthCallbackGET(request("http://localhost/auth/callback?code=abc"));

    expect(response.headers.get("location")).toBe("http://localhost/office");
    expect(mocks.ensureUserProfile).toHaveBeenCalledWith({
      userId: "oauth-user-1",
      email: "teacher@example.com",
      displayName: "OAuth Teacher",
      avatarUrl: "https://example.com/avatar.png",
      isAdmin: false,
    });
    expect(mocks.upsertMembership).toHaveBeenCalledWith({
      userId: "oauth-user-1",
      roomId: "meeting",
      role: "member",
    });
    expect(mocks.setAppSessionCookie).toHaveBeenCalledWith(response, {
      userId: "oauth-user-1",
      email: "Teacher@Example.com",
    });
  });

  it("rejects OAuth users who are not active approved users", async () => {
    stubSupabaseEnv();
    mocks.shouldUseMockData.mockReturnValue(false);
    mocks.createServerClient.mockReturnValue({
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "token" } }, error: null }),
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "oauth-user-2", email: "new@example.com" } } }),
        signOut: mocks.signOut,
      },
    });
    mocks.getAllowedUser.mockResolvedValue(null);

    const response = await oauthCallbackGET(request("http://localhost/auth/callback?code=abc"));

    expect(response.headers.get("location")).toBe("http://localhost/login?error=not-approved");
    expect(mocks.signOut).toHaveBeenCalled();
    expect(mocks.setAppSessionCookie).not.toHaveBeenCalled();
  });
});

describe("development login route", () => {
  it("rejects dev login when the host/env gate is disabled", async () => {
    vi.stubEnv("ENABLE_DEV_LOGIN", "false");

    const response = await devLoginGET(request("http://localhost/auth/dev-login", { host: "localhost" }));

    expect(response.headers.get("location")).toBe("http://localhost/login?error=dev-login-disabled");
    expect(mocks.getAllowedUser).not.toHaveBeenCalled();
  });

  it("sets the app session and redirects only to safe relative next paths", async () => {
    vi.stubEnv("ENABLE_DEV_LOGIN", "true");
    vi.stubEnv("DEV_LOGIN_EMAIL", "Teacher@Example.com");
    mocks.getAllowedUser.mockResolvedValue({ email: "teacher@example.com", isActive: true });
    mocks.getUserProfileByEmail.mockResolvedValue({ userId: "dev-user-1", email: "teacher@example.com" });

    const response = await devLoginGET(request("http://localhost/auth/dev-login?next=/admin", { host: "127.0.0.1:3137" }));

    expect(response.headers.get("location")).toBe("http://localhost/admin");
    expect(mocks.clearCurrentSupabaseAuthCookies).toHaveBeenCalledWith(response);
    expect(mocks.setAppSessionCookie).toHaveBeenCalledWith(response, {
      userId: "dev-user-1",
      email: "teacher@example.com",
    });
  });

  it("falls back to /office for unsafe dev-login next values", async () => {
    vi.stubEnv("ENABLE_DEV_LOGIN", "true");
    mocks.getAllowedUser.mockResolvedValue({ email: "school.x520@gmail.com", isActive: true });
    mocks.getUserProfileByEmail.mockResolvedValue({ userId: "dev-user-2", email: "school.x520@gmail.com" });

    const response = await devLoginGET(request("http://localhost/auth/dev-login?next=//evil.example/path", { host: "localhost" }));

    expect(response.headers.get("location")).toBe("http://localhost/office");
  });
});

describe("logout route", () => {
  it("returns 204 for prefetch requests", async () => {
    const response = await logoutGET(request("http://localhost/logout", { "next-router-prefetch": "1" }));

    expect(response.status).toBe(204);
    expect(mocks.clearAppSessionCookie).not.toHaveBeenCalled();
  });

  it("clears local auth cookies and redirects to login in mock mode", async () => {
    mocks.shouldUseMockData.mockReturnValue(true);

    const response = await logoutGET(request("http://localhost/logout"));

    expect(response.headers.get("location")).toBe("http://localhost/login");
    expect(mocks.clearCurrentSupabaseAuthCookies).toHaveBeenCalledWith(response);
    expect(mocks.clearAppSessionCookie).toHaveBeenCalledWith(response);
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("signs out Supabase before clearing cookies in real mode", async () => {
    mocks.shouldUseMockData.mockReturnValue(false);
    mocks.createSupabaseServerClient.mockResolvedValue({ auth: { signOut: mocks.signOut } });

    const response = await logoutGET(request("http://localhost/logout"));

    expect(response.headers.get("location")).toBe("http://localhost/login");
    expect(mocks.signOut).toHaveBeenCalled();
    expect(mocks.clearCurrentSupabaseAuthCookies).toHaveBeenCalledWith(response);
    expect(mocks.clearAppSessionCookie).toHaveBeenCalledWith(response);
  });
});
