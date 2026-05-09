import type { CreateVideoMeetingInput, ProviderCapability } from "@/types/video-meeting";
import type { VideoMeetingArtifact } from "@/types/domain";

export type ProviderMeetingResult = {
  providerSpaceName?: string | null;
  providerConferenceName?: string | null;
  providerMeetingId?: string | null;
  providerMeetingCode?: string | null;
  joinUrl?: string | null;
  hostUrl?: string | null;
  embedAllowed?: boolean;
  metadata?: Record<string, unknown>;
};

export interface VideoMeetingProvider {
  capability: ProviderCapability;
  createMeeting(input: CreateVideoMeetingInput): Promise<ProviderMeetingResult>;
  getMeetingStatus(providerId: string): Promise<string>;
  endMeeting(providerId: string): Promise<void>;
  listArtifacts(providerId: string): Promise<VideoMeetingArtifact[]>;
}
