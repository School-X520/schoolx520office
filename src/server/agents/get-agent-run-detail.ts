import "server-only";

import { statusError } from "@/lib/http-error";
import { publicAgentRunActivity } from "@/server/agents/agent-run-activity";
import { requireRoomMember } from "@/server/auth/require-room-member";
import { getDataStore } from "@/server/data/data-store";

// 봇 실행 1건의 상세(run + 출력 메시지 + 공개 활동 타임라인)를 조립한다.
// 이전에는 폴링 라우트(agent-runs/[runId] GET)가 이 조립을 직접 인라인으로 처리했다.
export async function getAgentRunDetail(input: { userId: string; roomId: string; runId: string }) {
  await requireRoomMember(input.userId, input.roomId);
  const source = getDataStore();

  const candidate = await source.getAgentRunById(input.runId);
  const run = candidate && candidate.roomId === input.roomId ? candidate : null;
  if (!run) {
    throw statusError("봇 실행을 찾을 수 없습니다.", 404);
  }

  // id 단건 조회 후 방 소속을 검증한다(이전에는 스레드 전체 메시지를 불러와 find()로 찾았다).
  const outputCandidate = run.outputMessageId ? await source.getMessageById(run.outputMessageId) : null;
  const outputMessage = outputCandidate && outputCandidate.roomId === input.roomId ? outputCandidate : null;
  const events = await source.listAgentRunEvents(input.runId);

  return { run, outputMessage, activity: publicAgentRunActivity(run, events) };
}
