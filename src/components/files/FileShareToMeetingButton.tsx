"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dialogOverlayClassName } from "@/components/ui/dialog-styles";
import { TextArea, TextInput } from "@/components/ui/form-controls";

export function FileShareToMeetingButton({
  fileId,
  roomId,
  fileName,
}: {
  fileId: string;
  roomId: string;
  fileName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(fileName);
  const [summary, setSummary] = useState(`${fileName} 파일을 메인 회의방에 공유합니다.`);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function shareFile() {
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/shared-items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceRoomId: roomId,
          sourceFileId: fileId,
          title: title.trim() || fileName,
          summary: summary.trim() || `${fileName} 파일을 메인 회의방에 공유합니다.`,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "메인 회의방에 공유하지 못했습니다.");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label={`${fileName} 메인 회의방에 공유`} title="메인 회의방에 공유">
          <Share2 className="size-4" />
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={dialogOverlayClassName} />
        <AlertDialog.Content className="motion-context-dialog fixed left-1/2 top-1/2 z-50 w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-line bg-card p-5 shadow-lg">
          <AlertDialog.Title className="text-base font-semibold text-balance">메인 회의방에 파일 공유</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-pretty text-ink-soft">
            이 파일이 메인 회의방 파일 목록에 추가되고, 회의방 채팅에 공유 카드가 남습니다.
          </AlertDialog.Description>
          <div className="mt-4 space-y-3">
            <label className="block text-sm font-medium">
              제목
              <TextInput value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1" />
            </label>
            <label className="block text-sm font-medium">
              설명
              <TextArea value={summary} onChange={(event) => setSummary(event.target.value)} className="mt-1 min-h-28" />
            </label>
          </div>
          {error ? <p className="mt-3 rounded-md border border-terracotta/30 bg-terracotta/10 p-2 text-sm text-terracotta">{error}</p> : null}
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                취소
              </Button>
            </AlertDialog.Cancel>
            <Button type="button" disabled={isPending} onClick={shareFile}>
              {isPending ? "공유 중" : "공유"}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
