import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// integration_tokens의 OAuth refresh/access 토큰을 애플리케이션 레벨에서 봉투 암호화한다.
// 형식: "enc:v1:" + base64(iv[12] | authTag[16] | ciphertext). prefix가 없으면 기존 평문으로 간주(마이그레이션 폴백).
const PREFIX = "enc:v1:";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer | null {
  const raw = process.env.INTEGRATION_TOKENS_ENC_KEY?.trim();
  if (!raw) {
    return null;
  }
  // 임의 길이의 시크릿을 SHA-256으로 32바이트 키로 정규화한다.
  return createHash("sha256").update(raw).digest();
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function encryptSecret(plaintext: string | null | undefined): string | null {
  if (plaintext == null || plaintext === "") {
    return null;
  }
  const key = getKey();
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "INTEGRATION_TOKENS_ENC_KEY가 설정되지 않아 연동 토큰을 안전하게 저장할 수 없습니다. `openssl rand -base64 32` 값을 설정하세요.",
      );
    }
    // 개발 환경 한정: 키가 없으면 평문 저장(읽기 시 폴백으로 처리됨).
    return plaintext;
  }
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decryptSecret(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  if (!isEncrypted(value)) {
    // 암호화 도입 이전에 저장된 평문 토큰 — 그대로 반환(다음 쓰기 때 암호화됨).
    return value;
  }
  const key = getKey();
  if (!key) {
    throw new Error(
      "INTEGRATION_TOKENS_ENC_KEY가 설정되지 않아 암호화된 연동 토큰을 복호화할 수 없습니다.",
    );
  }
  const raw = Buffer.from(value.slice(PREFIX.length), "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const tag = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
