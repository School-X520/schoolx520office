import "server-only";

import { shouldUseMockData } from "@/lib/env";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";
import { updateRoomMemory } from "@/server/memory/domain-memory-service";

export async function finalizeAgentRun(agentRunId: string) {
  const source = shouldUseMockData() ? mockStore : supabaseStore;
  const run = await source.getAgentRunById(agentRunId);
  if (!run) {
    return null;
  }

  const output = run.outputMessageId
    ? (await source.listMessages(run.roomId, run.threadId)).find((message) => message.id === run.outputMessageId)
    : null;

  const summary = output?.content.slice(0, 220) ?? "에이전트 실행이 완료되었습니다.";
  await source.updateThread(run.threadId, {
    summary,
    lastMessageAt: output?.createdAt ?? new Date().toISOString(),
  });

  // 기존 keyFacts는 보존하되 중복 텍스트를 제거하고 최근 50개로 제한한다.
  // (과거에는 매 실행마다 의미 없는 고정 문구를 무한 추가해 프롬프트 토큰을 낭비했다.)
  const existingKeyFacts = (await source.getMemory(run.roomId))?.keyFacts ?? [];
  const seenFactText = new Set<string>();
  const keyFacts = existingKeyFacts
    .filter((fact) => {
      const text = typeof fact.text === "string" ? fact.text.trim() : "";
      if (!text || seenFactText.has(text)) {
        return false;
      }
      seenFactText.add(text);
      return true;
    })
    .slice(-50);

  await updateRoomMemory(
    run.roomId,
    {
      summary,
      keyFacts,
    },
    agentRunId,
  );

  await source.addMemoryReview({
    roomId: run.roomId,
    agentRunId,
    proposedMemory: {
      summary,
      source: "finalizer",
    },
  });

  return { summary };
}
