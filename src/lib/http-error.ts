// HTTP 상태코드를 가진 에러를 한 곳에서 만든다.
// lib/api.ts의 jsonError가 `"status" in error`로 상태코드를 읽어 응답에 반영한다.
// (이전에는 `new Error(msg) as Error & { status }` 패턴이 13개 파일에 흩어져 status/status? 표기까지 갈렸다.)
export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function statusError(message: string, status: number): HttpError {
  return new HttpError(status, message);
}
