import { describe, expect, it, vi } from "vitest";

import { jsonError } from "@/lib/api";

function statusError(message: string, status: number) {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
}

describe("jsonError", () => {
  it("의도된 도메인 에러(4xx)의 메시지는 그대로 전달한다", async () => {
    const response = jsonError(statusError("이 방에 접근할 권한이 없습니다.", 403));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "이 방에 접근할 권한이 없습니다." });
  });

  it("예상치 못한 5xx는 내부 메시지를 숨기고 일반 문구를 반환한다", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = jsonError(new Error('relation "room_messages" does not exist'));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "요청 처리 중 오류가 발생했습니다." });
    spy.mockRestore();
  });

  it("명시적 500 status도 메시지를 숨긴다", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = jsonError(statusError("supabase internal detail", 500));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "요청 처리 중 오류가 발생했습니다." });
    spy.mockRestore();
  });

  it("Error가 아닌 값은 일반 문구로 처리한다", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = jsonError("문자열 오류");
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "요청 처리 중 오류가 발생했습니다." });
    spy.mockRestore();
  });
});
