import { afterEach, describe, expect, it, vi } from "vitest";

import { decryptSecret, encryptSecret, isEncrypted } from "@/server/integrations/token-crypto";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("token-crypto", () => {
  it("키가 있으면 암호화 후 복호화로 원문을 복원한다", () => {
    vi.stubEnv("INTEGRATION_TOKENS_ENC_KEY", "test-encryption-key-material");
    const plaintext = "1//0g-google-refresh-token-value";

    const encrypted = encryptSecret(plaintext);
    expect(encrypted).not.toBeNull();
    expect(isEncrypted(encrypted)).toBe(true);
    expect(encrypted).not.toContain(plaintext);
    expect(decryptSecret(encrypted)).toBe(plaintext);
  });

  it("매 암호화마다 다른 ciphertext를 생성한다(랜덤 IV)", () => {
    vi.stubEnv("INTEGRATION_TOKENS_ENC_KEY", "test-encryption-key-material");
    const a = encryptSecret("same-token");
    const b = encryptSecret("same-token");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe("same-token");
    expect(decryptSecret(b)).toBe("same-token");
  });

  it("기존 평문 값은 복호화 시 그대로 폴백한다", () => {
    vi.stubEnv("INTEGRATION_TOKENS_ENC_KEY", "test-encryption-key-material");
    expect(decryptSecret("legacy-plaintext-token")).toBe("legacy-plaintext-token");
  });

  it("null/빈 값은 그대로 통과시킨다", () => {
    vi.stubEnv("INTEGRATION_TOKENS_ENC_KEY", "test-encryption-key-material");
    expect(encryptSecret(null)).toBeNull();
    expect(encryptSecret("")).toBeNull();
    expect(decryptSecret(null)).toBeNull();
  });

  it("위변조된 ciphertext는 복호화에 실패한다", () => {
    vi.stubEnv("INTEGRATION_TOKENS_ENC_KEY", "test-encryption-key-material");
    const encrypted = encryptSecret("sensitive")!;
    const tampered = encrypted.slice(0, -2) + (encrypted.endsWith("AA") ? "BB" : "AA");
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("개발 환경에서 키가 없으면 평문으로 폴백한다", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(encryptSecret("dev-token")).toBe("dev-token");
    expect(isEncrypted("dev-token")).toBe(false);
  });

  it("프로덕션에서 키가 없으면 암호화 시 throw한다", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => encryptSecret("prod-token")).toThrow(/INTEGRATION_TOKENS_ENC_KEY/);
  });
});
