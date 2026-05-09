"use client";

import { Button } from "@/components/ui/button";

export function ZoomMeetingEmbed({ joinUrl }: { joinUrl?: string | null }) {
  return (
    <div className="rounded-lg border border-line bg-card p-4">
      <p className="text-sm font-semibold">Zoom 임베드 준비</p>
      <p className="mt-1 text-sm text-ink-soft">Meeting SDK는 환경변수와 Marketplace 앱 설정 후 활성화됩니다.</p>
      {joinUrl ? (
        <Button asChild className="mt-3" variant="secondary">
          <a href={joinUrl} target="_blank" rel="noreferrer">새 창으로 참여</a>
        </Button>
      ) : null}
    </div>
  );
}
