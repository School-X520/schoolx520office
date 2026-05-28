import { describe, expect, it } from "vitest";
import { mockUser } from "@/lib/mock-data";
import { createVideoMeeting, joinVideoMeeting } from "@/lib/video-meetings/service";
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
    expect(second.id).toBe(first.id);
    expect(mockStore.listVideoMeetings("meeting").filter((meeting) => meeting.status === "live")).toHaveLength(1);
    expect(mockStore.listVideoEvents(first.id).map((event) => event.eventType)).toEqual(
      expect.arrayContaining(["created", "live", "joined_intent"]),
    );
  });

  it("records join intent and keeps the shared join url", async () => {
    closeOpenMeetingRows("meeting");
    const meeting = await createVideoMeeting(mockUser.userId, {
      roomId: "meeting",
      provider: "google_meet",
      title: "참가 테스트",
      consentRecording: false,
      consentTranscript: false,
      consentAiSummary: true,
    });

    const joined = await joinVideoMeeting(mockUser.userId, meeting.id);

    expect(joined.id).toBe(meeting.id);
    expect(joined.joinUrl).toBe(meeting.joinUrl);
    expect(mockStore.listVideoEvents(meeting.id).map((event) => event.eventType)).toContain("joined_intent");
  });
});
