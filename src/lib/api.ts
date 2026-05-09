import { NextResponse } from "next/server";

export function jsonOk(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(error: unknown) {
  const message = error instanceof Error ? error.message : "요청 처리 중 오류가 발생했습니다.";
  const status =
    error instanceof Error && "status" in error && typeof error.status === "number"
      ? error.status
      : 500;
  return NextResponse.json({ error: message }, { status });
}
