import type { RoomMessage } from "@/types/domain";

// 메시지를 id 기준으로 합치고(중복 제거) 생성 시각순으로 정렬한다. 추가/갱신만 하며 기존 메시지를 제거하지 않으므로
// 진행 중인 낙관적(optimistic)·대기(pending) 메시지가 폴링/병합 과정에서 사라지지 않는다.
export function mergeMessages(current: RoomMessage[], incoming: RoomMessage[]): RoomMessage[] {
  const byId = new Map(current.map((message) => [message.id, message]));
  incoming.forEach((message) => byId.set(message.id, message));
  return [...byId.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

// 폴링으로 받은 서버 메시지를 병합하되, 같은 run의 실제 봇 출력이 도착하면 해당 run의 임시(pending) 메시지를 제거한다.
// (다른 사람이 호출한 봇 응답도 임시 메시지 잔상 없이 깔끔히 표시된다.)
export function mergeServerMessages(current: RoomMessage[], serverMessages: RoomMessage[]): RoomMessage[] {
  const resolvedRunIds = new Set(
    serverMessages
      .filter((message) => message.agentRunId && !message.metadata.pendingAgentRun)
      .map((message) => message.agentRunId),
  );
  const withoutResolvedPending = current.filter(
    (message) => !(message.metadata.pendingAgentRun && message.agentRunId && resolvedRunIds.has(message.agentRunId)),
  );
  return mergeMessages(withoutResolvedPending, serverMessages);
}
