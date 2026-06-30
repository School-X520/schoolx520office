import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActiveVideoMeetingBanner } from "@/components/video-meetings/ActiveVideoMeetingBanner";
import { CreateDecisionTaskFromSummary } from "@/components/video-meetings/CreateDecisionTaskFromSummary";
import { VideoMeetingJoinButton } from "@/components/video-meetings/VideoMeetingJoinButton";
import { VideoMeetingStartDialog } from "@/components/video-meetings/VideoMeetingStartDialog";
import { VideoMeetingArtifactCard } from "@/components/video-meetings/VideoMeetingArtifactCard";
import type { VideoMeeting, VideoMeetingArtifact } from "@/types/domain";

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

describe("VideoMeetingStartDialog", () => {
  it("uses a date-derived default title instead of a stale fixed month", async () => {
    render(<VideoMeetingStartDialog />);

    await userEvent.click(screen.getByRole("button", { name: "화상회의 시작" }));

    expect(screen.queryByDisplayValue("5월 정기 회의")).not.toBeInTheDocument();
    expect((screen.getByLabelText("회의 제목") as HTMLInputElement).value.endsWith("회의")).toBe(true);
  });
});

describe("dormant video meeting artifact actions", () => {
  it("renders artifact conversion actions as disabled until handlers are wired", () => {
    const artifact: VideoMeetingArtifact = {
      id: "artifact-1",
      videoMeetingId: "meeting-1",
      artifactType: "manual_minutes",
      title: "회의록",
      content: "결정사항 초안",
      externalUrl: null,
      fileId: null,
      providerArtifactName: null,
      status: "available",
      createdBy: null,
      metadata: {},
      createdAt: "2026-05-08T00:00:00Z",
    };

    render(
      <>
        <VideoMeetingArtifactCard artifact={artifact} />
        <CreateDecisionTaskFromSummary />
      </>,
    );

    for (const name of ["결정사항 만들기", "할 일 만들기", "작업방으로 가져가기", "결정사항 반영", "할 일 반영", "업무방으로 가져가기"]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
  });
});
