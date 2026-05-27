"use client";

import { useState } from "react";
import { Check, MessageSquarePlus, Pencil, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { RoomThread } from "@/types/domain";

export function RoomThreadControls({
  roomId,
  threads,
  activeThreadId,
}: {
  roomId: string;
  threads: RoomThread[];
  activeThreadId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isCreating, setIsCreating] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [titleOverrides, setTitleOverrides] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const activeThread = threads.find((thread) => thread.id === activeThreadId) ?? threads[0];
  const activeTitle = activeThread ? (titleOverrides[activeThread.id] ?? activeThread.title) : "현재 대화";

  function openThread(threadId: string) {
    router.push(`${pathname}?threadId=${encodeURIComponent(threadId)}`);
  }

  function startTitleEdit() {
    setDraftTitle(activeTitle);
    setError(null);
    setIsEditingTitle(true);
  }

  function cancelTitleEdit() {
    setIsEditingTitle(false);
    setDraftTitle("");
    setError(null);
  }

  async function saveTitle() {
    if (!activeThread || isSavingTitle) {
      return;
    }

    const nextTitle = draftTitle.trim();
    if (!nextTitle) {
      setError("대화 제목을 입력해 주세요.");
      return;
    }

    setIsSavingTitle(true);
    setError(null);
    try {
      const response = await fetch(`/api/rooms/${roomId}/threads/${activeThread.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: nextTitle }),
      });
      const payload = (await response.json()) as { thread?: RoomThread; error?: string };
      if (!response.ok || !payload.thread) {
        throw new Error(payload.error ?? "대화 제목을 바꾸지 못했습니다.");
      }
      setTitleOverrides((current) => ({ ...current, [payload.thread!.id]: payload.thread!.title }));
      setIsEditingTitle(false);
      setDraftTitle("");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "대화 제목을 바꾸지 못했습니다.");
    } finally {
      setIsSavingTitle(false);
    }
  }

  async function createThread() {
    if (isCreating) {
      return;
    }
    setIsCreating(true);
    setError(null);
    try {
      const response = await fetch(`/api/rooms/${roomId}/threads`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = (await response.json()) as { thread?: RoomThread; error?: string };
      if (!response.ok || !payload.thread) {
        throw new Error(payload.error ?? "새 대화를 만들지 못했습니다.");
      }
      openThread(payload.thread.id);
      router.refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "새 대화를 만들지 못했습니다.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="flex max-w-full flex-col items-end gap-1">
      <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
        <select
          value={activeThreadId}
          onChange={(event) => openThread(event.target.value)}
          aria-label="대화 선택"
          className="h-9 max-w-56 rounded-md border border-line bg-paper px-2 text-sm text-ink shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {threads.map((thread) => (
            <option key={thread.id} value={thread.id}>
              {titleOverrides[thread.id] ?? thread.title}
            </option>
          ))}
        </select>
        {isEditingTitle ? (
          <form
            className="flex max-w-full items-center gap-1"
            onSubmit={(event) => {
              event.preventDefault();
              void saveTitle();
            }}
          >
            <input
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              maxLength={80}
              aria-label="대화 제목"
              className="h-9 w-44 rounded-md border border-line bg-white px-2 text-sm text-ink shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2"
            />
            <Button type="submit" variant="secondary" size="icon" aria-label="대화 제목 저장" disabled={isSavingTitle}>
              <Check className="size-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" aria-label="대화 제목 편집 취소" onClick={cancelTitleEdit}>
              <X className="size-4" />
            </Button>
          </form>
        ) : (
          <Button type="button" variant="ghost" size="icon" aria-label="대화 제목 편집" onClick={startTitleEdit}>
            <Pencil className="size-4" />
          </Button>
        )}
        <Button type="button" variant="secondary" size="sm" onClick={createThread} disabled={isCreating}>
          <MessageSquarePlus className="size-4" />
          새 대화
        </Button>
      </div>
      {error ? <p className="max-w-72 text-right text-xs text-terracotta">{error}</p> : null}
    </div>
  );
}
