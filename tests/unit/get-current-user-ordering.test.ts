import { beforeEach, describe, expect, it, vi } from "vitest";

// getCurrentUser는 모든 인증 요청(버튼 클릭마다)이 거치는 핫패스다.
// 성능 회귀 방지: 앱 HMAC 세션 쿠키(OAuth/dev 로그인 모두 콜백에서 굽는다)가 있으면
// supabase.auth.getUser()(Supabase Auth 서버로의 네트워크 왕복)를 호출하지 않고
// 로컬 검증만으로 사용자를 식별해야 한다. getUser는 앱 세션이 없을 때만 폴백으로 쓴다.

const { shouldUseMockDataMock, readAppSessionUserMock, getUserMock } = vi.hoisted(() => ({
  shouldUseMockDataMock: vi.fn(),
  readAppSessionUserMock: vi.fn(),
  getUserMock: vi.fn(),
}));

vi.mock("@/lib/env", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/env")>();
  return { ...actual, shouldUseMockData: shouldUseMockDataMock };
});

vi.mock("@/server/auth/app-session", () => ({
  readAppSessionUser: readAppSessionUserMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: getUserMock },
  })),
}));

vi.mock("@/lib/supabase/admin", () => {
  const makeQuery = (data: unknown) => {
    const q: Record<string, unknown> = {
      select: () => q,
      eq: () => q,
      maybeSingle: async () => ({ data }),
    };
    return q;
  };
  return {
    getSupabaseAdminClient: () => ({
      from: (table: string) => {
        if (table === "allowed_users") return makeQuery({ is_active: true, is_admin: false });
        return makeQuery(null); // user_profiles 없음 → 합성 프로필(userId 보존)
      },
    }),
  };
});

async function loadGetCurrentUser() {
  // cache()로 감싸도 테스트 간 메모이즈가 새지 않도록 매번 새 모듈로 로드한다.
  vi.resetModules();
  return (await import("@/server/auth/get-current-user")).getCurrentUser;
}

beforeEach(() => {
  shouldUseMockDataMock.mockReturnValue(false);
  readAppSessionUserMock.mockReset();
  getUserMock.mockReset();
  // 기본값: Supabase 세션 없음(폴백이 호출돼도 깨끗하게 동작).
  getUserMock.mockResolvedValue({ data: { user: null } });
});

describe("getCurrentUser 인증 순서 (성능 핫패스)", () => {
  it("앱 세션 쿠키가 있으면 supabase.auth.getUser()를 호출하지 않는다(네트워크 왕복 회피)", async () => {
    readAppSessionUserMock.mockResolvedValue({ userId: "u-app", email: "app@x.com" });

    const getCurrentUser = await loadGetCurrentUser();
    const user = await getCurrentUser();

    expect(user?.userId).toBe("u-app");
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it("앱 세션이 없으면 supabase.auth.getUser()로 폴백한다", async () => {
    readAppSessionUserMock.mockResolvedValue(null);
    getUserMock.mockResolvedValue({
      data: { user: { id: "u-oauth", email: "oauth@x.com", user_metadata: {} } },
    });

    const getCurrentUser = await loadGetCurrentUser();
    const user = await getCurrentUser();

    expect(user?.userId).toBe("u-oauth");
    expect(getUserMock).toHaveBeenCalledTimes(1);
  });
});
