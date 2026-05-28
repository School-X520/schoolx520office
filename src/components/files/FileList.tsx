"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { FileText, Share2, X } from "lucide-react";
import { FileDeleteButton } from "@/components/files/FileDeleteButton";
import { FileDownloadButton } from "@/components/files/FileDownloadButton";
import { FileUploadForm } from "@/components/files/FileUploadForm";
import { WarmCard } from "@/components/layout/WarmCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type { FileRecord, RoomType } from "@/types/domain";

type ShareTargetRoom = {
  id: string;
  name: string;
  type: RoomType;
  role?: string;
};

export function FileList({ files, roomId }: { files: FileRecord[]; roomId: string }) {
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const selectedFiles = files.filter((file) => selectedFileIds.includes(file.id));

  function toggleFile(fileId: string) {
    setSelectedFileIds((current) =>
      current.includes(fileId) ? current.filter((id) => id !== fileId) : [...current, fileId],
    );
  }

  return (
    <WarmCard>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold">파일</p>
          <span className="text-xs text-ink-soft tabular-nums">{files.length}</span>
        </div>
        {files.length ? (
          <FileShareToRoomsDialog
            roomId={roomId}
            selectedFiles={selectedFiles}
            onShared={() => setSelectedFileIds([])}
          />
        ) : null}
      </div>
      <div className="space-y-2">
        {files.length ? (
          files.map((file) => (
            <div
              key={file.id}
              className={cn(
                "motion-context-row flex items-center gap-2 rounded-md border border-line bg-white/35 p-2",
                selectedFileIds.includes(file.id) && "border-sage/50 bg-sage/10",
              )}
            >
              <input
                type="checkbox"
                checked={selectedFileIds.includes(file.id)}
                onChange={() => toggleFile(file.id)}
                aria-label={`${file.originalName} 선택`}
                className="size-4 shrink-0 accent-sage"
              />
              <FileText className="size-4 text-bronze" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.originalName}</p>
                <p className="text-xs text-ink-soft tabular-nums">v{file.versionNo} · {Math.round(file.sizeBytes / 1024)}KB · {file.accessLevel}</p>
              </div>
              <FileDownloadButton fileId={file.id} roomId={roomId} />
              <FileDeleteButton fileId={file.id} roomId={roomId} fileName={file.originalName} />
            </div>
          ))
        ) : (
          <p className="text-sm text-ink-soft">아직 파일이 없습니다.</p>
        )}
      </div>
      <div className="mt-3">
        <FileUploadForm roomId={roomId} />
      </div>
    </WarmCard>
  );
}

function FileShareToRoomsDialog({
  roomId,
  selectedFiles,
  onShared,
}: {
  roomId: string;
  selectedFiles: FileRecord[];
  onShared: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rooms, setRooms] = useState<ShareTargetRoom[]>([]);
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openDialog(nextOpen: boolean) {
    setOpen(nextOpen);
    setNotice(null);
    if (!nextOpen || rooms.length) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/files/share-targets?sourceRoomId=${encodeURIComponent(roomId)}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as { rooms?: ShareTargetRoom[]; error?: string; message?: string };
      if (!response.ok || !payload.rooms) {
        setError(payload.error ?? payload.message ?? "공유할 방 목록을 불러오지 못했습니다.");
        return;
      }
      setRooms(payload.rooms);
    });
  }

  function toggleRoom(targetRoomId: string) {
    setSelectedRoomIds((current) =>
      current.includes(targetRoomId) ? current.filter((id) => id !== targetRoomId) : [...current, targetRoomId],
    );
    setNotice(null);
    setError(null);
  }

  function shareFiles() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const response = await fetch("/api/files/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceRoomId: roomId,
          sourceFileIds: selectedFiles.map((file) => file.id),
          targetRoomIds: selectedRoomIds,
        }),
      });
      const payload = (await response.json()) as { sharedItems?: unknown[]; error?: string; message?: string };
      if (!response.ok) {
        setError(payload.error ?? payload.message ?? "파일을 공유하지 못했습니다.");
        return;
      }
      setNotice(`${payload.sharedItems?.length ?? 0}개 공유 항목을 만들었습니다.`);
      setSelectedRoomIds([]);
      onShared();
      router.refresh();
      setOpen(false);
    });
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={openDialog}>
      <DialogPrimitive.Trigger asChild>
        <Button type="button" size="sm" variant="secondary" disabled={!selectedFiles.length}>
          <Share2 className="size-4" />
          다른 방에 공유하기
          {selectedFiles.length ? <span className="tabular-nums">{selectedFiles.length}</span> : null}
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="motion-context-overlay fixed inset-0 z-40 bg-ink/35" />
        <DialogPrimitive.Content
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="motion-context-dialog fixed left-1/2 top-[50dvh] z-50 grid max-h-[min(calc(100dvh-2rem),40rem)] w-[min(92vw,32rem)] -translate-x-1/2 -translate-y-1/2 grid-rows-[auto_auto_minmax(0,1fr)_auto_auto] gap-4 overflow-hidden rounded-lg border border-line bg-card p-5 shadow-xl"
        >
          <div className="space-y-1 pr-10">
            <DialogPrimitive.Title className="text-lg font-semibold text-balance">다른 방에 파일 공유</DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-pretty text-ink-soft">
              선택한 파일을 공유할 방을 고르면 각 방의 공유/반입 항목에 카드가 추가됩니다.
            </DialogPrimitive.Description>
          </div>
          <div className="rounded-md border border-line bg-white/40 p-3">
            <p className="text-xs font-medium text-ink-soft">선택한 파일</p>
            <ul className="mt-2 space-y-1">
              {selectedFiles.map((file) => (
                <li key={file.id} className="truncate text-sm">
                  {file.originalName}
                </li>
              ))}
            </ul>
          </div>
          <div className="min-h-0 space-y-2 overflow-y-auto pr-1">
            {rooms.map((room) => (
              <label key={room.id} className="flex cursor-pointer items-center gap-3 rounded-md border border-line bg-white/45 p-3 text-sm">
                <input
                  type="checkbox"
                  checked={selectedRoomIds.includes(room.id)}
                  onChange={() => toggleRoom(room.id)}
                  className="size-4 accent-sage"
                  aria-label={`${displayRoomName(room.name)} 공유 대상 선택`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{displayRoomName(room.name)}</span>
                  <span className="text-xs text-ink-soft">{room.type}</span>
                </span>
              </label>
            ))}
            {!rooms.length && !isPending ? <p className="text-sm text-ink-soft">공유할 수 있는 다른 방이 없습니다.</p> : null}
          </div>
          {notice ? <p className="rounded-md border border-sage/25 bg-sage/10 p-2 text-sm text-sage">{notice}</p> : null}
          {error ? <p className="rounded-md border border-terracotta/30 bg-terracotta/10 p-2 text-sm text-terracotta">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <DialogPrimitive.Close asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                취소
              </Button>
            </DialogPrimitive.Close>
            <Button type="button" onClick={shareFiles} disabled={isPending || !selectedFiles.length || !selectedRoomIds.length}>
              {isPending ? "공유 중" : "공유하기"}
            </Button>
          </div>
          <DialogPrimitive.Close asChild>
            <Button aria-label="닫기" variant="ghost" size="icon" className="absolute right-3 top-3">
              <X className="size-4" />
            </Button>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function displayRoomName(value: string) {
  if (value.endsWith("방") || value.endsWith("실") || value.endsWith("연구회")) {
    return value;
  }
  return `${value}방`;
}
