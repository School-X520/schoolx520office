import { describe, expect, it } from "vitest";
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
