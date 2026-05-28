"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FileDeleteButton({ fileId, roomId, fileName }: { fileId: string; roomId: string; fileName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function deleteFile() {
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/files", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomId, fileId }),
      });
      const result = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        setError(result.error ?? result.message ?? "파일을 삭제하지 못했습니다.");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label={`${fileName} 삭제`}>
          <Trash2 className="size-4" />
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="motion-context-overlay fixed inset-0 z-40 bg-black/35" />
        <AlertDialog.Content className="motion-context-dialog fixed left-1/2 top-1/2 z-50 w-[min(92vw,26rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-line bg-card p-5 shadow-lg">
          <AlertDialog.Title className="text-base font-semibold text-balance">파일 삭제</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-pretty text-ink-soft">
            이 방의 파일 목록에서 {fileName} 파일을 삭제합니다. 다른 방에서 공유 중인 파일이면 그 방의 접근은 유지됩니다.
          </AlertDialog.Description>
          {error ? <p className="mt-3 rounded-md border border-terracotta/30 bg-terracotta/10 p-2 text-sm text-terracotta">{error}</p> : null}
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                취소
              </Button>
            </AlertDialog.Cancel>
            <Button type="button" variant="danger" disabled={isPending} onClick={deleteFile}>
              {isPending ? "삭제 중" : "삭제"}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
