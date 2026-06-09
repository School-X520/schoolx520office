"use client";

import { useState, useTransition } from "react";
import { Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getGoogleMeetUrlForAccount } from "@/lib/video-meetings/join-url";

export function VideoMeetingJoinButton({
  meetingId,
  joinUrl,
  accountEmail,
  label = "회의 참가",
  size = "sm",
}: {
  meetingId: string;
  joinUrl: string;
  accountEmail?: string | null;
  label?: string;
  size?: "sm" | "md";
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function joinMeeting() {
    setError(null);
    if (!joinUrl) {
      setError("회의 참가 주소가 등록되어 있지 않습니다.");
      return;
    }

    window.open(getGoogleMeetUrlForAccount(joinUrl, accountEmail), "_blank", "noopener,noreferrer");
    startTransition(async () => {
      try {
        const response = await fetch(`/api/video-meetings/${meetingId}/join`, { method: "POST" });
        if (!response.ok) {
          const body = (await response.json()) as { error?: string };
          throw new Error(body.error ?? "회의 참가 기록을 남기지 못했습니다.");
        }
      } catch (joinError) {
        setError(joinError instanceof Error ? joinError.message : "회의 참가에 실패했습니다.");
      }
    });
  }

  return (
    <div className="grid gap-2">
      <Button type="button" size={size} onClick={joinMeeting} disabled={isPending}>
        <Video className="size-4" />
        {isPending ? "참가 준비 중" : label}
      </Button>
      {error ? (
        <p className="rounded-md border border-terracotta/30 bg-terracotta/10 px-2 py-1 text-xs text-terracotta" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
