import { jsonError, jsonOk } from "@/lib/api";
import { statusError } from "@/lib/http-error";
import { backfillDevelopmentAgentRequestMirrors } from "@/server/agents/development-request-mirror";
import { sweepStuckAgentRuns } from "@/server/agents/run-agent";
import { getDataStore } from "@/server/data/data-store";

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
    // 개발 요청 미러 backfill. 과거에는 개발방 페이지 진입 시 인라인 실행돼 렌더를 수 초 지연시켰다.
    // 실시간 미러링은 startAgentRun이 담당하므로 여기서는 누락분만 하루 1회 보정한다.
    // backfill 실패가 이미 커밋된 sweep 결과까지 cron 실패(500)로 가리지 않도록 격리한다.
    const mirrorBackfill = await backfillDevelopmentAgentRequestMirrors({ source: getDataStore() }).catch(
      (error: unknown) => ({ error: error instanceof Error ? error.message : String(error) }),
    );
    return jsonOk({ ...result, mirrorBackfill });
  } catch (error) {
    return jsonError(error);
  }
}

export const GET = handle;
export const POST = handle;
