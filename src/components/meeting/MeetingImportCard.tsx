"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bot, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/layout/StatusPill";
import type { MeetingImport } from "@/types/domain";

export function MeetingImportCard({ item }: { item: MeetingImport }) {
  const router = useRouter();
  const [status, setStatus] = useState(item.status);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"apply" | "task" | null>(null);
  const [isPending, startTransition] = useTransition();
  const isProcessed = status !== "pending";
  const title = meetingImportTitle(item);

  function runAction(action: "apply" | "task") {
    setError(null);
    setNotice(null);
    setPendingAction(action);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/meeting-imports/${item.id}/${action}`, { method: "POST" });
        const payload = (await response.json()) as {
          meetingImport?: MeetingImport;
          error?: string;
        };
        if (!response.ok || !payload.meetingImport) {
          setError(payload.error ?? "반입 항목을 처리하지 못했습니다.");
          return;
        }
        setStatus(payload.meetingImport.status);
        setNotice(action === "apply" ? "봇 맥락에 반영했습니다." : "할 일을 만들었습니다.");
        router.refresh();
      } catch {
        setError("반입 항목을 처리하지 못했습니다.");
      } finally {
        setPendingAction(null);
      }
    });
  }

  return (
    <article className="rounded-lg border border-sage/25 bg-sage/10 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <StatusPill tone="sage">메인 회의방에서 가져옴</StatusPill>
        <StatusPill tone={status === "processed" ? "gold" : "neutral"}>{status}</StatusPill>
      </div>
      <h3 className="font-semibold text-balance">{title}</h3>
      <p className="mt-1 text-sm text-pretty text-ink-soft">봇에게 반영시키거나 할 일로 전환할 수 있습니다.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => runAction("apply")} disabled={isPending || isProcessed}>
          <Bot className="size-4" />
          {pendingAction === "apply" ? "반영 중" : "봇에게 반영"}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => runAction("task")} disabled={isPending || isProcessed}>
          <ListChecks className="size-4" />
          {pendingAction === "task" ? "생성 중" : "할 일 만들기"}
        </Button>
      </div>
      {notice ? (
        <p className="mt-3 rounded-md border border-sage/25 bg-card p-2 text-sm text-sage" aria-live="polite">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-md border border-terracotta/30 bg-terracotta/10 p-2 text-sm text-terracotta" aria-live="polite">
          {error}
        </p>
      ) : null}
    </article>
  );
}

function meetingImportTitle(item: MeetingImport) {
  const sharedItemTitle = textValue(item.metadata.sharedItemTitle);
  const metadataTitle = textValue(item.metadata.title);
  return sharedItemTitle ?? metadataTitle ?? `${item.targetRoomId} 반입 항목`;
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
