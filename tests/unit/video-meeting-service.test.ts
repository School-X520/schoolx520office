import { describe, expect, it } from "vitest";
import { mockUser } from "@/lib/mock-data";
import { isActiveVideoMeeting, VIDEO_MEETING_ACTIVE_WINDOW_HOURS } from "@/lib/video-meetings/active";
import { createVideoMeeting, joinVideoMeeting, registerVideoMeetingJoinUrl } from "@/lib/video-meetings/service";
import { mockStore } from "@/server/data/mock-store";

function closeOpenMeetingRows(roomId: string) {
  for (const meeting of mockStore.listVideoMeetings(roomId)) {
    if (meeting.status === "scheduled" || meeting.status === "live") {
      mockStore.updateVideoMeeting(meeting.id, { status: "ended", endedAt: new Date().toISOString() });
    }
  }
}

describe("video meeting service", () => {
  it("creates one live meeting per room and reuses it for later start attempts", async () => {
    closeOpenMeetingRows("meeting");

    const first = await createVideoMeeting(mockUser.userId, {
      roomId: "meeting",
      provider: "google_meet",
      title: "운영 회의",
      consentRecording: false,
      consentTranscript: false,
      consentAiSummary: true,
    });
    const second = await createVideoMeeting(mockUser.userId, {
      roomId: "meeting",
      provider: "google_meet",
      title: "다른 회의 제목",
      consentRecording: false,
      consentTranscript: false,
      consentAiSummary: true,
    });

    expect(first.status).toBe("live");
    expect(first.joinUrl).toBeNull();
    expect(first.metadata.requiresJoinUrlRegistration).toBe(true);
    expect(second.id).toBe(first.id);
    expect(mockStore.listVideoMeetings("meeting").filter((meeting) => meeting.status === "live")).toHaveLength(1);
    expect(mockStore.listVideoEvents(first.id).map((event) => event.eventType)).toEqual(
      expect.arrayContaining(["created", "live", "joined_intent"]),
    );
  });

  it("registers the generated Meet link before users join", async () => {
    closeOpenMeetingRows("meeting");
    const meeting = await createVideoMeeting(mockUser.userId, {
      roomId: "meeting",
      provider: "google_meet",
      title: "참가 테스트",
      consentRecording: false,
      consentTranscript: false,
      consentAiSummary: true,
    });
    const registered = await registerVideoMeetingJoinUrl(
      mockUser.userId,
      meeting.id,
      "https://meet.google.com/ABC-DEFG-HIJ?authuser=0",
    );

    const joined = await joinVideoMeeting(mockUser.userId, meeting.id);

    expect(joined.id).toBe(meeting.id);
    expect(registered.joinUrl).toBe("https://meet.google.com/abc-defg-hij");
    expect(joined.joinUrl).toBe(registered.joinUrl);
    expect(mockStore.listVideoEvents(meeting.id).map((event) => event.eventType)).toContain("joined_intent");
    expect(mockStore.listVideoEvents(meeting.id).map((event) => event.eventType)).toContain("join_url_registered");
  });

  it("does not treat old live meetings as active", () => {
    const nowMs = Date.parse("2026-05-28T12:00:00.000Z");
    const staleStartedAt = new Date(nowMs - (VIDEO_MEETING_ACTIVE_WINDOW_HOURS + 1) * 60 * 60 * 1000).toISOString();

    expect(
      isActiveVideoMeeting(
        {
          id: "old-meeting",
          roomId: "meeting",
          provider: "google_meet",
          title: "오래된 회의",
          status: "live",
          joinUrl: "https://meet.google.com/abc-defg-hij",
          hostUrl: null,
          embedAllowed: false,
          startedAt: staleStartedAt,
          consentRecording: false,
          consentTranscript: false,
          consentAiSummary: true,
          metadata: {},
          createdAt: staleStartedAt,
          updatedAt: staleStartedAt,
        },
        nowMs,
      ),
    ).toBe(false);
  });
});
