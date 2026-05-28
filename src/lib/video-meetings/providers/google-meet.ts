import "server-only";

import { getServerEnv } from "@/lib/env";
import type { CreateVideoMeetingInput } from "@/types/video-meeting";
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

  async createMeeting(input: CreateVideoMeetingInput): Promise<ProviderMeetingResult> {
    const nickname = `schoolx-${input.roomId}-${crypto.randomUUID().slice(0, 8)}`.toLowerCase();
    const joinUrl = `https://g.co/meet/${nickname}`;

    if (!this.capability.enabled) {
      return {
        providerSpaceName: `mock-spaces/${crypto.randomUUID()}`,
        providerMeetingCode: nickname,
        joinUrl,
        metadata: { mode: "workspace_nickname_link", nickname },
      };
    }

    return {
      providerSpaceName: `setup-required/${crypto.randomUUID()}`,
      providerMeetingCode: nickname,
      joinUrl,
      metadata: {
        setupRequired: true,
        docs: "docs/GOOGLE_MEET_SETUP.md",
        fallbackMode: "workspace_nickname_link",
        nickname,
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
