import "server-only";

import { getServerEnv } from "@/lib/env";
import { normalizeGoogleMeetJoinUrl } from "@/lib/video-meetings/join-url";
import type { ProviderMeetingResult, VideoMeetingProvider } from "@/lib/video-meetings/provider";
import { getGoogleMeetAccessToken } from "@/server/integrations/google-oauth";
import type { CreateVideoMeetingInput } from "@/types/video-meeting";

type GoogleMeetSpace = {
  name?: unknown;
  meetingUri?: unknown;
  meetingCode?: unknown;
  activeConference?: {
    conferenceRecord?: unknown;
  };
};

type GoogleApiError = {
  source: "meet_spaces" | "calendar_events";
  status: number;
  message?: string | null;
  reason?: string | null;
};

type GoogleCalendarEvent = {
  id?: unknown;
  htmlLink?: unknown;
  hangoutLink?: unknown;
  conferenceData?: {
    entryPoints?: Array<{
      entryPointType?: unknown;
      uri?: unknown;
    }>;
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

  async createMeeting(input: CreateVideoMeetingInput): Promise<ProviderMeetingResult> {
    const accessToken = await getGoogleMeetAccessToken();
    if (!this.capability.enabled && !accessToken) {
      return manualGoogleMeetLinkResult("disabled");
    }
    if (!accessToken) {
      return manualGoogleMeetLinkResult("missing_oauth_token");
    }

    const errors: GoogleApiError[] = [];
    const meetSpace = await createMeetSpace(accessToken);
    if ("result" in meetSpace) {
      return meetSpace.result;
    }
    errors.push(meetSpace.error);

    const calendarEvent = await createCalendarMeetEvent(accessToken, input);
    if ("result" in calendarEvent) {
      return calendarEvent.result;
    }
    errors.push(calendarEvent.error);

    console.warn("[google-meet] automatic link creation failed:", errors);
    return manualGoogleMeetLinkResult("api_create_failed", errors);
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

async function createMeetSpace(accessToken: string): Promise<{ result: ProviderMeetingResult } | { error: GoogleApiError }> {
  const response = await fetch("https://meet.googleapis.com/v2/spaces", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({}),
  });
  const body = (await response.json().catch(() => ({}))) as GoogleMeetSpace & {
    error?: { message?: string; status?: string; details?: Array<{ reason?: string }> };
  };
  if (!response.ok) {
    return { error: googleApiError("meet_spaces", response.status, body) };
  }

  const rawJoinUrl = typeof body.meetingUri === "string" ? body.meetingUri : null;
  const joinUrl = rawJoinUrl ? normalizeGoogleMeetJoinUrl(rawJoinUrl) ?? rawJoinUrl : null;
  if (!joinUrl) {
    return {
      error: {
        source: "meet_spaces",
        status: response.status,
        message: "Google Meet space response did not include meetingUri.",
      },
    };
  }

  return {
    result: {
      providerSpaceName: typeof body.name === "string" ? body.name : null,
      providerConferenceName:
        typeof body.activeConference?.conferenceRecord === "string" ? body.activeConference.conferenceRecord : null,
      providerMeetingCode: typeof body.meetingCode === "string" ? body.meetingCode : null,
      joinUrl,
      metadata: {
        mode: "api_created_meet_space",
        autoRegisteredJoinUrl: true,
        requiresJoinUrlRegistration: false,
      },
    },
  };
}

async function createCalendarMeetEvent(
  accessToken: string,
  input: CreateVideoMeetingInput,
): Promise<{ result: ProviderMeetingResult } | { error: GoogleApiError }> {
  const start = new Date();
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      summary: input.title,
      description: input.description ?? "SchoolX 화상회의",
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      transparency: "transparent",
      conferenceData: {
        createRequest: {
          requestId: crypto.randomUUID(),
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    }),
  });
  const body = (await response.json().catch(() => ({}))) as GoogleCalendarEvent & {
    error?: { message?: string; status?: string; details?: Array<{ reason?: string }> };
  };
  if (!response.ok) {
    return { error: googleApiError("calendar_events", response.status, body) };
  }

  const videoEntry = body.conferenceData?.entryPoints?.find(
    (entry): entry is { entryPointType: "video"; uri: string } => entry.entryPointType === "video" && typeof entry.uri === "string",
  );
  const videoEntryUrl = videoEntry?.uri ?? null;
  const rawJoinUrl = typeof body.hangoutLink === "string" ? body.hangoutLink : videoEntryUrl;
  const joinUrl = rawJoinUrl ? normalizeGoogleMeetJoinUrl(rawJoinUrl) ?? rawJoinUrl : null;
  if (!joinUrl) {
    return {
      error: {
        source: "calendar_events",
        status: response.status,
        message: "Google Calendar event response did not include a Meet link.",
      },
    };
  }

  return {
    result: {
      providerSpaceName: typeof body.id === "string" ? `calendar-events/${body.id}` : null,
      joinUrl,
      metadata: {
        mode: "api_created_calendar_event",
        autoRegisteredJoinUrl: true,
        requiresJoinUrlRegistration: false,
        calendarEventId: typeof body.id === "string" ? body.id : null,
        calendarEventUrl: typeof body.htmlLink === "string" ? body.htmlLink : null,
      },
    },
  };
}

function googleApiError(source: GoogleApiError["source"], status: number, body: { error?: { message?: string; status?: string; details?: Array<{ reason?: string }> } }) {
  return {
    source,
    status,
    message: body.error?.message ?? null,
    reason: body.error?.status ?? body.error?.details?.find((detail) => detail.reason)?.reason ?? null,
  };
}

function manualGoogleMeetLinkResult(reason: string, errors?: GoogleApiError[]): ProviderMeetingResult {
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
      googleApiErrors: errors ?? [],
    },
  };
}
