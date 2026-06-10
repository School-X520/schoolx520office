import "server-only";

import { z } from "zod";

import { statusError } from "@/lib/http-error";

// 라우트 본문을 Zod 스키마로 검증한다. 실패 시 400 HttpError를 던져 jsonError가 일관되게 처리한다.
// (이전에는 대부분의 라우트가 `request.json() as {...}` 타입 단언만 써서 런타임 검증이 없었다.)
export async function parseJsonBody<S extends z.ZodTypeAny>(request: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw statusError("요청 본문을 해석할 수 없습니다.", 400);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw statusError(parsed.error.issues[0]?.message ?? "요청 형식이 올바르지 않습니다.", 400);
  }
  return parsed.data;
}
