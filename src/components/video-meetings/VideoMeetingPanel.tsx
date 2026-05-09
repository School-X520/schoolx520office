import { Video, FileText } from "lucide-react";
import { WarmCard } from "@/components/layout/WarmCard";
import { StatusPill } from "@/components/layout/StatusPill";
import { Button } from "@/components/ui/button";
import { VideoMeetingStartDialog } from "@/components/video-meetings/VideoMeetingStartDialog";
import type { VideoMeeting } from "@/types/domain";

export function VideoMeetingPanel({
  activeMeeting,
  compact,
}: {
  activeMeeting?: VideoMeeting | null;
  compact?: boolean;
}) {
  return (
    <WarmCard className="office-side-card office-video-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Video className="size-4 text-sage" />
            화상회의
          </p>
          <p className="office-video-copy mt-1 text-sm text-pretty text-ink-soft">
            Google Meet 링크형을 기본으로 회의 결과물을 회의방에 남깁니다.
          </p>
        </div>
        {activeMeeting ? <StatusPill tone="live">{activeMeeting.status}</StatusPill> : null}
      </div>
      {activeMeeting ? (
        <div className="mt-4 rounded-md border border-sage/25 bg-sage/10 p-3">
          <p className="line-clamp-1 text-sm font-semibold">{activeMeeting.title}</p>
          <p className="mt-1 text-xs text-ink-soft">{activeMeeting.provider === "google_meet" ? "Google Meet" : "Zoom"}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {activeMeeting.joinUrl ? (
              <Button asChild size="sm">
                <a href={activeMeeting.joinUrl} target="_blank" rel="noreferrer">
                  <Video className="size-4" />
                  회의 입장
                </a>
              </Button>
            ) : null}
            <Button asChild size="sm" variant="secondary">
              <a href={`/rooms/${activeMeeting.roomId}`}>
                <FileText className="size-4" />
                회의록 보기
              </a>
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <VideoMeetingStartDialog compact={compact} />
        </div>
      )}
    </WarmCard>
  );
}
