import "server-only";

import { getServerEnv } from "@/lib/env";
import type { ProviderMeetingResult, VideoMeetingProvider } from "@/lib/video-meetings/provider";

export class GoogleMeetProvider implements VideoMeetingProvider {
  capability = {
    id: "google_meet" as const,
    name: "Google Meet",
    enabled: getServerEnv().GOOGLE_MEET_ENABLED === "true",
    supportsEmbed: false,
    supportsRecordings: true,
    supportsTranscripts: true,
  };

  async createMeeting(): Promise<ProviderMeetingResult> {
    if (!this.capability.enabled) {
      return {
        providerSpaceName: `mock-spaces/${crypto.randomUUID()}`,
        providerMeetingCode: null,
        joinUrl: null,
        metadata: {
          mode: "manual_google_meet_link",
          openUrl: "https://meet.google.com/new",
          requiresJoinUrlRegistration: true,
        },
      };
    }

    return {
      providerSpaceName: `setup-required/${crypto.randomUUID()}`,
      providerMeetingCode: null,
      joinUrl: null,
      metadata: {
        setupRequired: true,
        docs: "docs/GOOGLE_MEET_SETUP.md",
        fallbackMode: "manual_google_meet_link",
        openUrl: "https://meet.google.com/new",
        requiresJoinUrlRegistration: true,
      },
    };
  }

  async getMeetingStatus() {
    return "scheduled";
  }

  async endMeeting() {
    return;
  }

  async listArtifacts() {
    return [];
  }
}
