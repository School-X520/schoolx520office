import "server-only";

import { getServerEnv, getPublicEnv } from "@/lib/env";
import type { ProviderMeetingResult, VideoMeetingProvider } from "@/lib/video-meetings/provider";

export class ZoomProvider implements VideoMeetingProvider {
  capability = {
    id: "zoom" as const,
    name: "Zoom",
    enabled: getServerEnv().ZOOM_ENABLED === "true",
    supportsEmbed: getPublicEnv().NEXT_PUBLIC_ENABLE_ZOOM_EMBED === "true",
    supportsRecordings: true,
    supportsTranscripts: true,
  };

  async createMeeting(): Promise<ProviderMeetingResult> {
    return {
      providerMeetingId: `mock-zoom-${crypto.randomUUID()}`,
      joinUrl: "https://zoom.us/j/000000000",
      hostUrl: this.capability.enabled ? "https://zoom.us/s/host-placeholder" : null,
      embedAllowed: this.capability.supportsEmbed,
      metadata: {
        setupRequired: !this.capability.enabled,
        docs: "docs/ZOOM_SETUP.md",
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
