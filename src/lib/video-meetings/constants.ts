export const VIDEO_PROVIDERS = {
  googleMeet: "google_meet",
  zoom: "zoom",
} as const;

export const VIDEO_MEETING_STATUSES = ["scheduled", "live", "ended", "canceled", "failed"] as const;

export const VIDEO_ARTIFACT_TYPES = [
  "recording",
  "transcript",
  "transcript_entry",
  "ai_summary",
  "manual_minutes",
  "provider_metadata",
] as const;

export const VIDEO_EVENT_TYPES = [
  "created",
  "joined_intent",
  "live",
  "ended",
  "artifact_ready",
  "transcript_imported",
  "summary_created",
  "error",
] as const;
