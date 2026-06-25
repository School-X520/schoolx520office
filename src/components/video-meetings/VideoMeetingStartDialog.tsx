"use client";

import { useState, useTransition } from "react";
import { Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextArea, TextInput } from "@/components/ui/form-controls";
import { VideoMeetingProviderPicker } from "@/components/video-meetings/VideoMeetingProviderPicker";
import { VideoMeetingConsentOptions } from "@/components/video-meetings/VideoMeetingConsentOptions";
import { getGoogleMeetUrlForAccount, getVideoMeetingOpenUrl, isRegisteredVideoMeetingJoinUrl } from "@/lib/video-meetings/join-url";
import type { VideoMeeting } from "@/types/domain";

export function VideoMeetingStartDialog({ compact, accountEmail }: { compact?: boolean; accountEmail?: string | null }) {
  const [title, setTitle] = useState(defaultMeetingTitle);
  const [description, setDescription] = useState("메인 회의방 화상회의");
  const [provider, setProvider] = useState<"google_meet" | "zoom">("google_meet");
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState(false);
  const [summary, setSummary] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function createMeeting() {
    setError(null);
    const meetingWindow = window.open("about:blank", "_blank");
    if (meetingWindow) {
      meetingWindow.opener = null;
      meetingWindow.document.title = "화상회의 준비 중";
      meetingWindow.document.body.textContent = "화상회의 창을 준비 중입니다.";
    }
    startTransition(async () => {
      const response = await fetch("/api/video-meetings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roomId: "meeting",
          provider,
          title,
          description,
          consentRecording: recording,
          consentTranscript: transcript,
          consentAiSummary: summary,
        }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        meetingWindow?.close();
        setError(body.error ?? "회의 생성에 실패했습니다.");
        return;
      }
      const body = (await response.json()) as { meeting: VideoMeeting };
      const openUrl = getGoogleMeetUrlForAccount(body.meeting.joinUrl ?? getVideoMeetingOpenUrl(body.meeting), accountEmail);
      if (openUrl) {
        if (meetingWindow) {
          meetingWindow.location.href = openUrl;
        } else {
          window.open(openUrl, "_blank", "noopener,noreferrer");
        }
      } else {
        meetingWindow?.close();
      }
      if (!isRegisteredVideoMeetingJoinUrl(body.meeting)) {
        window.alert(
          "Google Meet 창에서 실제 회의 주소를 복사한 뒤 SchoolX 화상회의 카드의 링크 등록 칸에 붙여넣어 주세요. 등록 후 다른 사용자가 같은 회의에 참가할 수 있습니다.",
        );
      }
      window.location.href = "/rooms/meeting";
    });
  }

  return (
    <Dialog
      title="화상회의 시작"
      description="녹화와 전사는 민감 기능입니다. 회의 시작 전에 동의 상태를 명확히 남깁니다."
      trigger={
        <Button className={compact ? "w-full" : ""}>
          <Video className="size-4" />
          화상회의 시작
        </Button>
      }
    >
      <div className="space-y-4">
        <label className="grid gap-1 text-sm font-medium">
          회의 제목
          <TextInput value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          설명
          <TextArea value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <VideoMeetingProviderPicker value={provider} onChange={setProvider} />
        <VideoMeetingConsentOptions
          recording={recording}
          transcript={transcript}
          summary={summary}
          onRecordingChange={setRecording}
          onTranscriptChange={setTranscript}
          onSummaryChange={setSummary}
        />
        {error ? <p className="rounded-md border border-terracotta/35 bg-terracotta/10 p-3 text-sm text-terracotta">{error}</p> : null}
        <Button disabled={isPending || !title.trim()} onClick={createMeeting} className="w-full">
          {isPending ? "시작 중" : "회의 시작"}
        </Button>
      </div>
    </Dialog>
  );
}

function defaultMeetingTitle() {
  const dateLabel = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
  }).format(new Date());
  return `${dateLabel} 회의`;
}
