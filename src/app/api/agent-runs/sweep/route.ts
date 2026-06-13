import { jsonError, jsonOk } from "@/lib/api";
import { statusError } from "@/lib/http-error";
import { sweepStuckAgentRuns } from "@/server/agents/run-agent";

export const maxDuration = 60;

// 좀비 run 정리 백스톱. Vercel Cron(및 수동 운영 호출)에서만 접근하며 CRON_SECRET Bearer 토큰으로 보호한다.
// Vercel Cron은 요청에 `Authorization: Bearer <CRON_SECRET>` 헤더를 실어 보낸다.
function assertCronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    throw statusError("CRON_SECRET이 설정되지 않아 스윕 엔드포인트를 사용할 수 없습니다.", 503);
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    throw statusError("권한이 없습니다.", 401);
  }
}

async function handle(request: Request) {
  try {
    assertCronAuthorized(request);
    const result = await sweepStuckAgentRuns();
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}

export const GET = handle;
export const POST = handle;
