import { Bot, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/layout/StatusPill";
import type { MeetingImport } from "@/types/domain";

export function MeetingImportCard({ item }: { item: MeetingImport }) {
  return (
    <article className="rounded-lg border border-sage/25 bg-sage/10 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <StatusPill tone="sage">메인 회의방에서 가져옴</StatusPill>
        <StatusPill tone={item.status === "processed" ? "gold" : "neutral"}>{item.status}</StatusPill>
      </div>
      <h3 className="font-semibold text-balance">{item.targetRoomId} 반입 항목</h3>
      <p className="mt-1 text-sm text-pretty text-ink-soft">봇에게 반영시키거나 할 일로 전환할 수 있습니다.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm">
          <Bot className="size-4" />
          봇에게 반영
        </Button>
        <Button size="sm" variant="secondary">
          <ListChecks className="size-4" />
          할 일 만들기
        </Button>
      </div>
    </article>
  );
}
