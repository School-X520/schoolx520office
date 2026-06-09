import "server-only";

import { getServerEnv } from "@/lib/env";
import { normalizeGoogleMeetJoinUrl } from "@/lib/video-meetings/join-url";
import type { ProviderMeetingResult, VideoMeetingProvider } from "@/lib/video-meetings/provider";
import { getGoogleMeetAccessToken } from "@/server/integrations/google-oauth";

type GoogleMeetSpace = {
  name?: unknown;
  meetingUri?: unknown;
  meetingCode?: unknown;
  activeConference?: {
    conferenceRecord?: unknown;
  };
};

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
      return manualGoogleMeetLinkResult("disabled");
    }

    const accessToken = await getGoogleMeetAccessToken();
    if (!accessToken) {
      return manualGoogleMeetLinkResult("missing_oauth_token");
    }

    try {
      const response = await fetch("https://meet.googleapis.com/v2/spaces", {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const space = (await response.json().catch(() => ({}))) as GoogleMeetSpace;
      if (!response.ok) {
        throw new Error("Google Meet space creation failed.");
      }

      const rawJoinUrl = typeof space.meetingUri === "string" ? space.meetingUri : null;
      const joinUrl = rawJoinUrl ? normalizeGoogleMeetJoinUrl(rawJoinUrl) ?? rawJoinUrl : null;
      if (!joinUrl) {
        throw new Error("Google Meet space response did not include meetingUri.");
      }

      return {
        providerSpaceName: typeof space.name === "string" ? space.name : null,
        providerConferenceName:
          typeof space.activeConference?.conferenceRecord === "string" ? space.activeConference.conferenceRecord : null,
        providerMeetingCode: typeof space.meetingCode === "string" ? space.meetingCode : null,
        joinUrl,
        metadata: {
          mode: "api_created_meet_space",
          autoRegisteredJoinUrl: true,
          requiresJoinUrlRegistration: false,
        },
      };
    } catch (error) {
      console.warn("[google-meet] create space failed:", error instanceof Error ? error.message : error);
      return manualGoogleMeetLinkResult("api_create_failed");
    }
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

function manualGoogleMeetLinkResult(reason: string): ProviderMeetingResult {
  return {
    providerSpaceName: `manual-link/${crypto.randomUUID()}`,
    providerMeetingCode: null,
    joinUrl: null,
    metadata: {
      setupRequired: reason !== "disabled",
      docs: "docs/GOOGLE_MEET_SETUP.md",
      fallbackReason: reason,
      fallbackMode: "manual_google_meet_link",
      mode: "manual_google_meet_link",
      openUrl: "https://meet.google.com/new",
      requiresJoinUrlRegistration: true,
    },
  };
}
