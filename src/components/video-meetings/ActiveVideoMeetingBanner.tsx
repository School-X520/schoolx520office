import { Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/layout/StatusPill";
import type { VideoMeeting } from "@/types/domain";

export function ActiveVideoMeetingBanner({ meeting }: { meeting?: VideoMeeting | null }) {
  if (!meeting) {
    return null;
  }
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sage/30 bg-sage/10 p-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-sage text-white">
          <Video className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-balance">지금 메인 화상회의가 진행 중입니다.</p>
          <p className="truncate text-sm text-ink-soft">{meeting.title} · {meeting.provider === "google_meet" ? "Google Meet" : "Zoom"}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone="live">{meeting.status}</StatusPill>
        {meeting.joinUrl ? (
          <Button asChild size="sm">
            <a href={meeting.joinUrl} target="_blank" rel="noreferrer">
              회의 입장
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
