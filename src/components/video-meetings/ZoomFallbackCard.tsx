import { Button } from "@/components/ui/button";

export function ZoomFallbackCard({ joinUrl }: { joinUrl?: string | null }) {
  return (
    <div className="rounded-md border border-line bg-gold-soft/50 p-3">
      <p className="text-sm font-semibold">Zoom 임베드를 사용할 수 없습니다.</p>
      <p className="mt-1 text-sm text-ink-soft">브라우저 권한 또는 SDK 설정을 확인하고, 우선 새 창으로 참여하세요.</p>
      {joinUrl ? (
        <Button asChild size="sm" className="mt-3">
          <a href={joinUrl} target="_blank" rel="noreferrer">Zoom에서 입장</a>
        </Button>
      ) : null}
    </div>
  );
}
