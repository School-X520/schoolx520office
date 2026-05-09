import { ArrowDownToLine, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/layout/StatusPill";
import type { SharedItem } from "@/types/domain";

export function SharedItemCard({ item }: { item: SharedItem }) {
  return (
    <article className="rounded-lg border border-bronze/30 bg-gold-soft/55 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <StatusPill tone="gold">{item.sourceRoomId}에서 공유됨</StatusPill>
        <time className="text-xs text-ink-soft">{new Date(item.createdAt).toLocaleString("ko-KR")}</time>
      </div>
      <h3 className="font-semibold text-balance">{item.title}</h3>
      <p className="mt-1 text-sm text-pretty text-ink-soft">{item.summary}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary">
          <ExternalLink className="size-4" />
          원본 보기
        </Button>
        <Button size="sm">
          <ArrowDownToLine className="size-4" />
          작업방으로 가져가기
        </Button>
      </div>
    </article>
  );
}
