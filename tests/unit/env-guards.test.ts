import { afterEach, describe, expect, it, vi } from "vitest";

import { assertProductionEnv, isAuthDebugEnabled, shouldUseMockData } from "@/lib/env";

function stubSupabaseEnv() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("shouldUseMockData", () => {
  it("개발/테스트 환경에서는 Supabase 미설정 시 mock으로 폴백한다", () => {
    expect(shouldUseMockData()).toBe(true);
  });

  it("개발/테스트 환경에서 명시적 플래그가 켜지면 mock을 사용한다", () => {
    stubSupabaseEnv();
    vi.stubEnv("NEXT_PUBLIC_USE_MOCK_DATA", "true");
    expect(shouldUseMockData()).toBe(true);
  });

  it("Supabase가 설정되어 있고 플래그가 꺼져 있으면 real 모드를 사용한다", () => {
    stubSupabaseEnv();
    expect(shouldUseMockData()).toBe(false);
  });

  it("프로덕션 런타임에서 Supabase 미설정 시 mock으로 폴백하지 않고 throw한다", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => shouldUseMockData()).toThrow(/누락/);
  });

  it("프로덕션 런타임에서 명시적 mock 플래그를 거부한다", () => {
    vi.stubEnv("NODE_ENV", "production");
    stubSupabaseEnv();
    vi.stubEnv("NEXT_PUBLIC_USE_MOCK_DATA", "true");
    expect(() => shouldUseMockData()).toThrow(/허용되지 않습니다/);
  });

  it("프로덕션 런타임에서 Supabase가 설정돼 있으면 real 모드를 반환한다", () => {
    vi.stubEnv("NODE_ENV", "production");
    stubSupabaseEnv();
    expect(shouldUseMockData()).toBe(false);
  });

  it("next build 단계에서는 프로덕션이라도 throw하지 않는다", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    expect(shouldUseMockData()).toBe(true);
  });
});

describe("assertProductionEnv", () => {
  it("프로덕션이 아니면 아무것도 검증하지 않는다", () => {
    expect(() => assertProductionEnv()).not.toThrow();
  });

  it("프로덕션에서 필수 변수가 모두 있으면 통과한다", () => {
    vi.stubEnv("NODE_ENV", "production");
    stubSupabaseEnv();
    vi.stubEnv("APP_SESSION_SECRET", "test-session-secret");
    expect(() => assertProductionEnv()).not.toThrow();
  });

  it("프로덕션에서 APP_SESSION_SECRET 누락을 잡아낸다", () => {
    vi.stubEnv("NODE_ENV", "production");
    stubSupabaseEnv();
    expect(() => assertProductionEnv()).toThrow(/APP_SESSION_SECRET/);
  });

  it("프로덕션에서 mock 플래그를 금지한다", () => {
    vi.stubEnv("NODE_ENV", "production");
    stubSupabaseEnv();
    vi.stubEnv("APP_SESSION_SECRET", "test-session-secret");
    vi.stubEnv("NEXT_PUBLIC_USE_MOCK_DATA", "true");
    expect(() => assertProductionEnv()).toThrow(/NEXT_PUBLIC_USE_MOCK_DATA/);
  });

  it("real agents가 켜져 있으면 ANTHROPIC_API_KEY를 요구한다", () => {
    vi.stubEnv("NODE_ENV", "production");
    stubSupabaseEnv();
    vi.stubEnv("APP_SESSION_SECRET", "test-session-secret");
    vi.stubEnv("ENABLE_REAL_AGENTS", "true");
    expect(() => assertProductionEnv()).toThrow(/ANTHROPIC_API_KEY/);
  });
});

describe("isAuthDebugEnabled", () => {
  it("개발/테스트 환경에서는 허용한다", () => {
    expect(isAuthDebugEnabled()).toBe(true);
  });

  it("프로덕션에서는 기본 차단한다", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(isAuthDebugEnabled()).toBe(false);
  });

  it("프로덕션에서도 명시적 플래그로만 허용한다", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_AUTH_DEBUG", "true");
    expect(isAuthDebugEnabled()).toBe(true);
  });
});
