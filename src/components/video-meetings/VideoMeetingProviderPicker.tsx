"use client";

import { getPublicEnv } from "@/lib/env";

export function VideoMeetingProviderPicker({
  value,
  onChange,
}: {
  value: "google_meet" | "zoom";
  onChange: (value: "google_meet" | "zoom") => void;
}) {
  const zoomVisible = getPublicEnv().NEXT_PUBLIC_ENABLE_ZOOM_EMBED === "true";
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Provider</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        <ProviderOption
          label="Google Meet"
          description="새 탭에서 공식 Meet 화면으로 입장"
          checked={value === "google_meet"}
          onChange={() => onChange("google_meet")}
        />
        {zoomVisible ? (
          <ProviderOption
            label="Zoom"
            description="설정 시 앱 안 참여와 새 창 fallback"
            checked={value === "zoom"}
            onChange={() => onChange("zoom")}
          />
        ) : null}
      </div>
    </fieldset>
  );
}

function ProviderOption({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-line bg-white/50 p-3 text-sm">
      <input type="radio" checked={checked} onChange={onChange} className="mt-1" />
      <span>
        <span className="block font-medium">{label}</span>
        <span className="text-xs text-ink-soft">{description}</span>
      </span>
    </label>
  );
}
