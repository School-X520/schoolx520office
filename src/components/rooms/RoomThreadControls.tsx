"use client";

import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
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
  const [error, setError] = useState<string | null>(null);

  function openThread(threadId: string) {
    router.push(`${pathname}?threadId=${encodeURIComponent(threadId)}`);
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
      <div className="flex max-w-full items-center gap-2">
        <select
          value={activeThreadId}
          onChange={(event) => openThread(event.target.value)}
          aria-label="대화 선택"
          className="h-9 max-w-56 rounded-md border border-line bg-paper px-2 text-sm text-ink shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {threads.map((thread) => (
            <option key={thread.id} value={thread.id}>
              {thread.title}
            </option>
          ))}
        </select>
        <Button type="button" variant="secondary" size="sm" onClick={createThread} disabled={isCreating}>
          <MessageSquarePlus className="size-4" />
          새 대화
        </Button>
      </div>
      {error ? <p className="max-w-72 text-right text-xs text-terracotta">{error}</p> : null}
    </div>
  );
}
