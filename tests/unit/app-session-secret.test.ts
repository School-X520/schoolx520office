import { describe, expect, it } from "vitest";

import { resolveAppSessionSecret } from "@/server/auth/app-session";

describe("resolveAppSessionSecret", () => {
  it("APP_SESSION_SECRET이 있으면 그대로 사용한다", () => {
    const result = resolveAppSessionSecret({
      APP_SESSION_SECRET: "dedicated-secret",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      NODE_ENV: "production",
    });
    expect(result).toEqual({ secret: "dedicated-secret", usingFallback: false });
  });

  it("프로덕션에서는 service role 키 폴백을 거부한다", () => {
    expect(() =>
      resolveAppSessionSecret({
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        NODE_ENV: "production",
      }),
    ).toThrow(/APP_SESSION_SECRET/);
  });

  it("개발 환경에서는 service role 키로 폴백하되 폴백임을 표시한다", () => {
    const result = resolveAppSessionSecret({
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      NODE_ENV: "development",
    });
    expect(result).toEqual({ secret: "service-role-key", usingFallback: true });
  });

  it("둘 다 없으면 throw한다", () => {
    expect(() => resolveAppSessionSecret({ NODE_ENV: "development" })).toThrow(/APP_SESSION_SECRET/);
  });

  it("공백뿐인 시크릿은 미설정으로 취급한다", () => {
    expect(() =>
      resolveAppSessionSecret({
        APP_SESSION_SECRET: "   ",
        NODE_ENV: "production",
      }),
    ).toThrow(/APP_SESSION_SECRET/);
  });
});
