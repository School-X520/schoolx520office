import type { VideoMeeting } from "@/types/domain";

const GOOGLE_MEET_CODE_PATTERN = /^\/([a-z]{3}-[a-z]{4}-[a-z]{3})$/i;

export function normalizeGoogleMeetJoinUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const candidate = trimmed.startsWith("http") ? trimmed : `https://meet.google.com/${trimmed}`;
  try {
    const url = new URL(candidate);
    const host = url.hostname.toLowerCase();
    const match = url.pathname.match(GOOGLE_MEET_CODE_PATTERN);
    if (host !== "meet.google.com" || !match) {
      return null;
    }
    return `https://meet.google.com/${match[1].toLowerCase()}`;
  } catch {
    return null;
  }
}

export function isRegisteredVideoMeetingJoinUrl(meeting: VideoMeeting) {
  if (!meeting.joinUrl) {
    return false;
  }
  if (meeting.metadata.requiresJoinUrlRegistration === true) {
    return false;
  }
  if (meeting.metadata.mode === "workspace_nickname_link" || meeting.metadata.fallbackMode === "workspace_nickname_link") {
    return false;
  }
  return true;
}

export function getVideoMeetingOpenUrl(meeting: VideoMeeting) {
  return typeof meeting.metadata.openUrl === "string" ? meeting.metadata.openUrl : "https://meet.google.com/new";
}
