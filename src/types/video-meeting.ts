import type { VideoMeeting, VideoMeetingArtifact, VideoMeetingEvent } from "@/types/domain";

export type ProviderCapability = {
  id: "google_meet" | "zoom";
  name: string;
  enabled: boolean;
  supportsEmbed: boolean;
  supportsRecordings: boolean;
  supportsTranscripts: boolean;
};

export type CreateVideoMeetingInput = {
  roomId: string;
  provider: "google_meet" | "zoom";
  title: string;
  description?: string;
  consentRecording: boolean;
  consentTranscript: boolean;
  consentAiSummary: boolean;
};

export type SanitizedVideoMeeting = Omit<VideoMeeting, "hostUrl"> & {
  hostUrl?: never;
};

export type VideoMeetingParticipant = {
  id: string;
  videoMeetingId: string;
  userId?: string | null;
  providerParticipantId?: string | null;
  displayName: string;
  email?: string | null;
  role: "host" | "cohost" | "participant" | "guest";
  joinedAt?: string | null;
  leftAt?: string | null;
  durationSeconds?: number | null;
};

export type { VideoMeeting, VideoMeetingArtifact, VideoMeetingEvent };
