import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActiveVideoMeetingBanner } from "@/components/video-meetings/ActiveVideoMeetingBanner";
import { VideoMeetingJoinButton } from "@/components/video-meetings/VideoMeetingJoinButton";
import type { VideoMeeting } from "@/types/domain";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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

describe("VideoMeetingJoinButton", () => {
  it("opens the registered Meet URL immediately and records the join intent", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ meeting: {} }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <VideoMeetingJoinButton
        meetingId="meeting-1"
        joinUrl="https://meet.google.com/abc-defg-hij"
        accountEmail="Teacher@Example.COM"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /회의 참가/ }));

    expect(open).toHaveBeenCalledWith(
      "https://meet.google.com/abc-defg-hij?authuser=teacher%40example.com",
      "_blank",
      "noopener,noreferrer",
    );
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/video-meetings/meeting-1/join", { method: "POST" });
    });
  });
});
