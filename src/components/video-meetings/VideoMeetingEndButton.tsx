"use client";

import { useState, useTransition } from "react";
import { Square } from "lucide-react";
import { Button } from "@/components/ui/button";

export function VideoMeetingEndButton({
  meetingId,
  onEnded,
}: {
  meetingId: string;
  onEnded?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function endMeeting() {
    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/video-meetings/${meetingId}/end`, { method: "POST" });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(body.error ?? "회의를 종료하지 못했습니다.");
        return;
      }
      if (onEnded) {
        onEnded();
      } else {
        window.location.reload();
      }
    });
  }

  return (
    <div className="grid gap-2">
      <Button type="button" size="sm" variant="secondary" onClick={endMeeting} disabled={isPending}>
        <Square className="size-3.5" />
        {isPending ? "종료 중" : "회의 종료"}
      </Button>
      {error ? (
        <p className="rounded-md border border-terracotta/30 bg-terracotta/10 px-2 py-1 text-xs text-terracotta" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
