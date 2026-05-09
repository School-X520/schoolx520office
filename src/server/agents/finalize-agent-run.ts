import "server-only";

import { shouldUseMockData } from "@/lib/env";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";
import { updateRoomMemory } from "@/server/memory/domain-memory-service";

export async function finalizeAgentRun(agentRunId: string) {
  const source = shouldUseMockData() ? mockStore : supabaseStore;
  const run = (await source.listAgentRuns()).find((item) => item.id === agentRunId);
  if (!run) {
    return null;
  }

  const output = run.outputMessageId
    ? (await source.listMessages(run.roomId)).find((message) => message.id === run.outputMessageId)
    : null;

  const summary = output?.content.slice(0, 220) ?? "에이전트 실행이 완료되었습니다.";
  await updateRoomMemory(
    run.roomId,
    {
      summary,
      keyFacts: [
        ...((await source.getMemory(run.roomId))?.keyFacts ?? []),
        { id: crypto.randomUUID(), text: "최근 봇 실행 결과가 domain_memory에 반영되었습니다." },
      ],
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
