"use client";

import { useEffect, useState } from "react";
import { FileText, Video } from "lucide-react";
import { WarmCard } from "@/components/layout/WarmCard";
import { StatusPill } from "@/components/layout/StatusPill";
import { Button } from "@/components/ui/button";
import { isActiveVideoMeeting } from "@/lib/video-meetings/active";
import { isRegisteredVideoMeetingJoinUrl } from "@/lib/video-meetings/join-url";
import { VideoMeetingEndButton } from "@/components/video-meetings/VideoMeetingEndButton";
import { VideoMeetingJoinButton } from "@/components/video-meetings/VideoMeetingJoinButton";
import { VideoMeetingJoinUrlForm } from "@/components/video-meetings/VideoMeetingJoinUrlForm";
import { VideoMeetingStartDialog } from "@/components/video-meetings/VideoMeetingStartDialog";
import type { VideoMeeting } from "@/types/domain";

export function VideoMeetingPanel({
  activeMeeting,
  compact,
}: {
  activeMeeting?: VideoMeeting | null;
  compact?: boolean;
}) {
  const [currentMeeting, setCurrentMeeting] = useState<VideoMeeting | null>(activeMeeting ?? null);

  useEffect(() => {
    let isMounted = true;

    async function refreshActiveMeeting() {
      try {
        const response = await fetch("/api/video-meetings?roomId=meeting", { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const body = (await response.json()) as { meetings?: VideoMeeting[] };
        const meeting = body.meetings?.find((item) => isActiveVideoMeeting(item)) ?? null;
        if (isMounted) {
          setCurrentMeeting(meeting);
        }
      } catch {
        return;
      }
    }

    const interval = window.setInterval(refreshActiveMeeting, 15000);
    void refreshActiveMeeting();
    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <WarmCard className="office-side-card office-video-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Video className="size-4 text-sage" />
            화상회의
          </p>
          <p className="office-video-copy mt-1 text-sm text-pretty text-ink-soft">
            진행 중인 회의가 있으면 새로 만들지 않고 같은 회의로 참가합니다.
          </p>
        </div>
        {currentMeeting ? <StatusPill tone="live">진행 중</StatusPill> : null}
      </div>
      {currentMeeting ? (
        <div className="mt-4 rounded-md border border-sage/25 bg-sage/10 p-3">
          <p className="text-xs font-semibold text-sage">현재 화상회의 진행 중</p>
          <p className="line-clamp-1 text-sm font-semibold">{currentMeeting.title}</p>
          <p className="mt-1 text-xs text-ink-soft">{currentMeeting.provider === "google_meet" ? "Google Meet" : "Zoom"}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {isRegisteredVideoMeetingJoinUrl(currentMeeting) ? (
              <VideoMeetingJoinButton meetingId={currentMeeting.id} joinUrl={currentMeeting.joinUrl ?? ""} />
            ) : null}
            <VideoMeetingEndButton meetingId={currentMeeting.id} onEnded={() => setCurrentMeeting(null)} />
            <Button asChild size="sm" variant="secondary">
              <a href={`/rooms/${currentMeeting.roomId}`}>
                <FileText className="size-4" />
                회의방 보기
              </a>
            </Button>
          </div>
          {!isRegisteredVideoMeetingJoinUrl(currentMeeting) ? (
            <div className="mt-3">
              <VideoMeetingJoinUrlForm meeting={currentMeeting} onRegistered={setCurrentMeeting} />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4">
          <VideoMeetingStartDialog compact={compact} />
        </div>
      )}
    </WarmCard>
  );
}
