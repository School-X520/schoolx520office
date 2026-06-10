"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { Bot, ListChecks, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dialogOverlayClassName } from "@/components/ui/dialog-styles";
import { StatusPill } from "@/components/layout/StatusPill";
import { meetingImportStatusLabel } from "@/lib/status-labels";
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
    <article className="motion-continuity-item rounded-lg border border-sage/25 bg-sage/10 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <StatusPill tone="sage">메인 회의방에서 가져옴</StatusPill>
        <StatusPill tone={status === "processed" ? "gold" : "neutral"}>{meetingImportStatusLabel(status)}</StatusPill>
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
        <DeleteMeetingImportButton item={item} />
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

function DeleteMeetingImportButton({ item }: { item: MeetingImport }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const title = meetingImportTitle(item);

  function deleteItem() {
    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/meeting-imports/${item.id}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        setError(payload.error ?? payload.message ?? "반입 항목을 삭제하지 못했습니다.");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger asChild>
        <Button size="sm" variant="secondary" aria-label={`${title} 반입 항목 삭제`}>
          <Trash2 className="size-4" />
          삭제
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={dialogOverlayClassName} />
        <AlertDialog.Content className="motion-context-dialog fixed left-1/2 top-1/2 z-50 w-[min(92vw,26rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-line bg-card p-5 shadow-lg">
          <AlertDialog.Title className="text-base font-semibold text-balance">반입 항목 삭제</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-pretty text-ink-soft">
            {title} 반입 항목을 목록에서 삭제합니다. 복사된 파일은 파일 목록에서 별도로 삭제할 수 있습니다.
          </AlertDialog.Description>
          {error ? <p className="mt-3 rounded-md border border-terracotta/30 bg-terracotta/10 p-2 text-sm text-terracotta">{error}</p> : null}
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                취소
              </Button>
            </AlertDialog.Cancel>
            <Button type="button" variant="danger" disabled={isPending} onClick={deleteItem}>
              {isPending ? "삭제 중" : "삭제"}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
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
