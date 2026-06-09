import { describe, expect, it } from "vitest";
import { getGoogleMeetUrlForAccount } from "@/lib/video-meetings/join-url";
import { sanitizeVideoMeetingResponse } from "@/lib/video-meetings/permissions";

describe("sanitizeVideoMeetingResponse", () => {
  it("removes hostUrl from client payloads", () => {
    const result = sanitizeVideoMeetingResponse({
      id: "meeting",
      title: "test",
      hostUrl: "https://secret.example",
    });
    expect("hostUrl" in result).toBe(false);
  });
});

describe("getGoogleMeetUrlForAccount", () => {
  it("adds the SchoolX account hint to Google Meet URLs", () => {
    expect(getGoogleMeetUrlForAccount("https://meet.google.com/abc-defg-hij", "Teacher@Example.COM")).toBe(
      "https://meet.google.com/abc-defg-hij?authuser=teacher%40example.com",
    );
  });

  it("does not modify non-Google Meet URLs", () => {
    expect(getGoogleMeetUrlForAccount("https://example.com/meeting", "teacher@example.com")).toBe("https://example.com/meeting");
  });
});
