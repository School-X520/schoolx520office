import type { VideoMeeting } from "@/types/domain";

export const VIDEO_MEETING_ACTIVE_WINDOW_HOURS = 6;

export function isActiveVideoMeeting(meeting: VideoMeeting, nowMs = Date.now()) {
  if (meeting.status !== "live" && meeting.status !== "scheduled") {
    return false;
  }

  const timestamp = meeting.startedAt ?? meeting.scheduledStartAt ?? meeting.createdAt;
  const startedMs = Date.parse(timestamp);
  if (!Number.isFinite(startedMs)) {
    return false;
  }

  return nowMs - startedMs < VIDEO_MEETING_ACTIVE_WINDOW_HOURS * 60 * 60 * 1000;
}
