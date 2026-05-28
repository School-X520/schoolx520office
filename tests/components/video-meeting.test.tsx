import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActiveVideoMeetingBanner } from "@/components/video-meetings/ActiveVideoMeetingBanner";
import type { VideoMeeting } from "@/types/domain";

describe("ActiveVideoMeetingBanner", () => {
  it("renders active meeting", () => {
    const meeting: VideoMeeting = {
      id: "v",
      roomId: "meeting",
      provider: "google_meet",
      title: "5월 정기 회의",
      status: "live",
      joinUrl: "https://meet.google.com/abc-defg-hij",
      hostUrl: null,
      embedAllowed: false,
      consentRecording: false,
      consentTranscript: false,
      consentAiSummary: true,
      metadata: {},
      createdAt: "2026-05-08T00:00:00Z",
      updatedAt: "2026-05-08T00:00:00Z",
    };
    render(<ActiveVideoMeetingBanner meeting={meeting} />);
    expect(screen.getByText("지금 메인 화상회의가 진행 중입니다.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /회의 참가/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /회의 종료/ })).toBeInTheDocument();
  });
});
