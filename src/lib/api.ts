import { NextResponse } from "next/server";

export function jsonOk(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(error: unknown) {
  const status =
    error instanceof Error && "status" in error && typeof error.status === "number"
      ? error.status
      : 500;

  // 의도된 도메인 에러(명시적 status < 500)의 메시지는 사용자에게 보여줄 목적으로 작성되었으므로 그대로 전달한다.
  // 그 외(예상치 못한 5xx)는 내부 메시지(DB 에러, 스토리지 경로 등)가 새지 않도록 일반 문구로 치환하고
  // 상세는 서버 로그로만 남긴다.
  if (status >= 500) {
    console.error("[api] 처리되지 않은 오류", error);
    return NextResponse.json({ error: "요청 처리 중 오류가 발생했습니다." }, { status });
  }

  const message = error instanceof Error ? error.message : "요청을 처리할 수 없습니다.";
  return NextResponse.json({ error: message }, { status });
}
