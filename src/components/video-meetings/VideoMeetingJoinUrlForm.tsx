"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/form-controls";
import { getVideoMeetingOpenUrl } from "@/lib/video-meetings/join-url";
import type { VideoMeeting } from "@/types/domain";

export function VideoMeetingJoinUrlForm({
  meeting,
  onRegistered,
}: {
  meeting: VideoMeeting;
  onRegistered?: (meeting: VideoMeeting) => void;
}) {
  const [joinUrl, setJoinUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const openUrl = getVideoMeetingOpenUrl(meeting);

  function registerJoinUrl() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/video-meetings/${meeting.id}/join-url`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ joinUrl }),
      });
      const body = (await response.json()) as { meeting?: VideoMeeting; error?: string };
      if (!response.ok || !body.meeting) {
        setError(body.error ?? "Meet 링크를 등록하지 못했습니다.");
        return;
      }
      setJoinUrl("");
      setMessage("Meet 링크를 등록했습니다.");
      if (onRegistered) {
        onRegistered(body.meeting);
      } else {
        window.location.reload();
      }
    });
  }

  return (
    <div className="grid gap-3 rounded-md border border-gold-soft bg-gold-soft/35 p-3">
      <div className="grid gap-1">
        <p className="text-sm font-semibold text-ink">실제 Google Meet 링크 등록 필요</p>
        <p className="text-xs text-pretty text-ink-soft">
          새 회의 화면에서 생성된 주소를 붙여넣으면 다른 사용자가 같은 회의로 참가할 수 있습니다.
        </p>
      </div>
      <Button asChild size="sm" variant="secondary" className="w-fit">
        <a href={openUrl} target="_blank" rel="noreferrer">
          <ExternalLink className="size-4" />
          Google Meet 새 회의 열기
        </a>
      </Button>
      <div className="flex flex-col gap-2 sm:flex-row">
        <TextInput
          value={joinUrl}
          onChange={(event) => setJoinUrl(event.target.value)}
          placeholder="https://meet.google.com/abc-defg-hij"
          aria-label="Google Meet 링크"
        />
        <Button type="button" size="sm" onClick={registerJoinUrl} disabled={isPending || !joinUrl.trim()}>
          <Link2 className="size-4" />
          {isPending ? "등록 중" : "링크 등록"}
        </Button>
      </div>
      {message ? (
        <p className="rounded-md border border-sage/25 bg-sage/10 px-2 py-1 text-xs text-sage" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-md border border-terracotta/30 bg-terracotta/10 px-2 py-1 text-xs text-terracotta" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
