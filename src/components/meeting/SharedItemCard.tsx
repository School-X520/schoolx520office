"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowDownToLine, ExternalLink, FolderOpen, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dialogOverlayClassName } from "@/components/ui/dialog-styles";
import { TextInput } from "@/components/ui/form-controls";
import { StatusPill } from "@/components/layout/StatusPill";
import { roomTypeLabel } from "@/lib/status-labels";
import type { RoomType, SharedItem } from "@/types/domain";

type ImportTargetRoom = {
  id: string;
  name: string;
  type: RoomType;
  role?: string;
};

export function SharedItemCard({ item }: { item: SharedItem }) {
  const sourceLabel = `${displayRoomName(item.sourceRoomName ?? metadataText(item.metadata.sourceRoomName) ?? item.sourceRoomId)}에서 공유됨`;

  return (
    <article className="motion-continuity-item rounded-lg border border-bronze/30 bg-gold-soft/55 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <StatusPill tone="gold">{sourceLabel}</StatusPill>
        <time className="text-xs text-ink-soft">{new Date(item.createdAt).toLocaleString("ko-KR")}</time>
      </div>
      <h3 className="font-semibold text-balance">{item.title}</h3>
      <p className="mt-1 text-sm text-pretty text-ink-soft">{item.summary}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <OpenOriginalDialog item={item} />
        {item.targetRoomId === "meeting" ? <ImportToRoomsDialog item={item} /> : null}
        <DeleteSharedItemButton item={item} />
      </div>
    </article>
  );
}

function DeleteSharedItemButton({ item }: { item: SharedItem }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function deleteItem() {
    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/shared-items/${item.id}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        setError(payload.error ?? payload.message ?? "공유 항목을 삭제하지 못했습니다.");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger asChild>
        <Button size="sm" variant="secondary" aria-label={`${item.title} 공유 항목 삭제`}>
          <Trash2 className="size-4" />
          삭제
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={dialogOverlayClassName} />
        <AlertDialog.Content className="motion-context-dialog fixed left-1/2 top-1/2 z-50 w-[min(92vw,26rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-line bg-card p-5 shadow-lg">
          <AlertDialog.Title className="text-base font-semibold text-balance">공유 항목 삭제</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-pretty text-ink-soft">
            {item.title} 공유 항목을 목록에서 삭제합니다. 원본 파일 자체는 삭제하지 않습니다.
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

function OpenOriginalDialog({ item }: { item: SharedItem }) {
  const [open, setOpen] = useState(false);
  const [downloadDir, setDownloadDir] = useState("~/Downloads/School-X");
  const [resultPath, setResultPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openOriginal() {
    setError(null);
    setResultPath(null);
    startTransition(async () => {
      const response = await fetch(`/api/shared-items/${item.id}/open-original`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ downloadDir }),
      });
      const payload = (await response.json()) as { filePath?: string; error?: string };
      if (!response.ok || !payload.filePath) {
        setError(payload.error ?? "원본 파일을 열지 못했습니다.");
        return;
      }
      setResultPath(payload.filePath);
    });
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button size="sm" variant="secondary" disabled={!item.sourceFileId}>
          <ExternalLink className="size-4" />
          원본 보기
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={dialogOverlayClassName} />
        <DialogPrimitive.Content className="motion-context-dialog fixed left-1/2 top-1/2 z-50 grid w-[min(92vw,30rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border border-line bg-card p-5 shadow-xl">
          <div className="space-y-1 pr-10">
            <DialogPrimitive.Title className="text-lg font-semibold text-balance">원본 파일 열기</DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-pretty text-ink-soft">
              지정한 로컬 폴더에 파일을 저장한 뒤 기본 앱으로 엽니다.
            </DialogPrimitive.Description>
          </div>
          <label className="block text-sm font-medium">
            다운로드 폴더
            <TextInput value={downloadDir} onChange={(event) => setDownloadDir(event.target.value)} className="mt-1" />
          </label>
          {resultPath ? (
            <p className="rounded-md border border-sage/25 bg-sage/10 p-2 text-sm text-sage">
              저장 후 열었습니다: {resultPath}
            </p>
          ) : null}
          {error ? <p className="rounded-md border border-terracotta/30 bg-terracotta/10 p-2 text-sm text-terracotta">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <DialogPrimitive.Close asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                닫기
              </Button>
            </DialogPrimitive.Close>
            <Button type="button" onClick={openOriginal} disabled={isPending || !downloadDir.trim()}>
              <FolderOpen className="size-4" />
              {isPending ? "여는 중" : "다운로드 후 열기"}
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

function ImportToRoomsDialog({ item }: { item: SharedItem }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rooms, setRooms] = useState<ImportTargetRoom[]>([]);
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openDialog(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen || rooms.length) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/meeting-imports/targets", { cache: "no-store" });
      const payload = (await response.json()) as { rooms?: ImportTargetRoom[]; error?: string };
      if (!response.ok || !payload.rooms) {
        setError(payload.error ?? "작업방 목록을 불러오지 못했습니다.");
        return;
      }
      setRooms(payload.rooms);
    });
  }

  function toggleRoom(roomId: string) {
    setSelectedRoomIds((current) =>
      current.includes(roomId) ? current.filter((id) => id !== roomId) : [...current, roomId],
    );
    setNotice(null);
    setError(null);
  }

  function importToRooms() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const response = await fetch("/api/meeting-imports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetRoomIds: selectedRoomIds,
          sharedItemId: item.id,
          sourceFileId: item.sourceFileId,
          summary: item.summary,
        }),
      });
      const payload = (await response.json()) as { imports?: unknown[]; error?: string };
      if (!response.ok) {
        setError(payload.error ?? "작업방으로 가져가지 못했습니다.");
        return;
      }
      setNotice(`${payload.imports?.length ?? selectedRoomIds.length}개 작업방으로 가져갔습니다.`);
      router.refresh();
    });
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={openDialog}>
      <DialogPrimitive.Trigger asChild>
        <Button size="sm">
          <ArrowDownToLine className="size-4" />
          작업방으로 가져가기
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={dialogOverlayClassName} />
        <DialogPrimitive.Content
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="motion-context-dialog fixed left-1/2 top-[50dvh] z-50 grid max-h-[min(calc(100dvh-2rem),40rem)] w-[min(92vw,32rem)] -translate-x-1/2 -translate-y-1/2 grid-rows-[auto_minmax(0,1fr)_auto_auto] gap-4 overflow-hidden rounded-lg border border-line bg-card p-5 shadow-xl"
        >
          <div className="space-y-1 pr-10">
            <DialogPrimitive.Title className="text-lg font-semibold text-balance">작업방으로 가져가기</DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-pretty text-ink-soft">
              선택한 작업방으로 파일을 복사하고 반입 기록을 남깁니다.
            </DialogPrimitive.Description>
          </div>
          <div className="min-h-0 space-y-2 overflow-y-auto pr-1">
            {rooms.map((room) => (
              <label key={room.id} className="flex cursor-pointer items-center gap-3 rounded-md border border-line bg-white/45 p-3 text-sm">
                <input
                  type="checkbox"
                  checked={selectedRoomIds.includes(room.id)}
                  onChange={() => toggleRoom(room.id)}
                  className="size-4 accent-sage"
                  aria-label={`${displayRoomName(room.name)} 가져가기 대상 선택`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{displayRoomName(room.name)}</span>
                  <span className="text-xs text-ink-soft">{roomTypeLabel(room.type)}</span>
                </span>
              </label>
            ))}
            {!rooms.length && !isPending ? <p className="text-sm text-ink-soft">가져갈 수 있는 작업방이 없습니다.</p> : null}
          </div>
          {notice ? <p className="rounded-md border border-sage/25 bg-sage/10 p-2 text-sm text-sage">{notice}</p> : null}
          {error ? <p className="rounded-md border border-terracotta/30 bg-terracotta/10 p-2 text-sm text-terracotta">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <DialogPrimitive.Close asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                닫기
              </Button>
            </DialogPrimitive.Close>
            <Button type="button" onClick={importToRooms} disabled={isPending || !selectedRoomIds.length}>
              {isPending ? "가져가는 중" : "가져가기"}
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

function metadataText(value: unknown) {
  return typeof value === "string" ? value : null;
}
