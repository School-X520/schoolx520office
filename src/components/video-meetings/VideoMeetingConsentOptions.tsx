"use client";

export function VideoMeetingConsentOptions({
  recording,
  transcript,
  summary,
  onRecordingChange,
  onTranscriptChange,
  onSummaryChange,
}: {
  recording: boolean;
  transcript: boolean;
  summary: boolean;
  onRecordingChange: (value: boolean) => void;
  onTranscriptChange: (value: boolean) => void;
  onSummaryChange: (value: boolean) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">동의 옵션</legend>
      <Check label="녹화 동의" checked={recording} onChange={onRecordingChange} />
      <Check label="전사 동의" checked={transcript} onChange={onTranscriptChange} />
      <Check label="AI 요약 동의" checked={summary} onChange={onSummaryChange} />
      <p className="text-xs text-pretty text-ink-soft">
        학생 개인정보나 외부 기관 민감정보가 포함될 수 있으면 녹화/전사/AI 요약 전에 별도 확인이 필요합니다.
      </p>
    </fieldset>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}
