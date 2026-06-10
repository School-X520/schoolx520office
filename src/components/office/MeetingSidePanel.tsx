import { Bot, ClipboardList, FilePlus2, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WarmCard } from "@/components/layout/WarmCard";
import { StatusPill } from "@/components/layout/StatusPill";
import { VideoMeetingPanel } from "@/components/video-meetings/VideoMeetingPanel";
import { OperationStatusCard } from "@/components/office/OperationStatusCard";
import type { OperationStatusSnapshot, SharedItem, VideoMeeting } from "@/types/domain";

export function MeetingSidePanel({
  sharedItems,
  activeMeeting,
  operationStatus,
  accountEmail,
}: {
  sharedItems: SharedItem[];
  activeMeeting?: VideoMeeting | null;
  operationStatus: OperationStatusSnapshot;
  accountEmail?: string | null;
}) {
  return (
    <div className="office-side-panel flex h-full min-h-0 flex-col gap-4">
      <OperationStatusCard initialStatus={operationStatus} />
      <WarmCard className="office-side-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">메인 회의방</p>
            <p className="office-side-copy mt-1 text-sm text-pretty text-ink-soft">공유, 브리핑, 결정사항을 한 곳에서 정리합니다.</p>
          </div>
          <StatusPill tone="gold">Hub</StatusPill>
        </div>
        <div className="office-action-grid mt-4 grid grid-cols-2 gap-2">
          <Action href="/rooms/meeting" icon={<Bot className="size-4" />} label="봇 호출" />
          <Action href="/rooms/meeting" icon={<FilePlus2 className="size-4" />} label="공유 작성" />
          <Action href="/rooms/meeting" icon={<ClipboardList className="size-4" />} label="작업 반입" />
          <Action href="/rooms/meeting" icon={<ListChecks className="size-4" />} label="할 일 만들기" />
        </div>
      </WarmCard>
      <VideoMeetingPanel activeMeeting={activeMeeting ?? null} accountEmail={accountEmail} compact />
      <WarmCard className="office-side-card office-recent-card">
        <p className="mb-3 text-sm font-semibold">최근 공유 카드</p>
        {sharedItems.length ? (
          <div className="space-y-2">
            {sharedItems.slice(0, 3).map((item) => (
              <div key={item.id} className="rounded-md border border-line bg-white/35 p-3">
                <p className="line-clamp-1 text-sm font-medium">{item.title}</p>
                <p className="office-recent-summary line-clamp-2 text-xs text-ink-soft">{item.summary}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-ink-soft">아직 회의방으로 공유된 카드가 없습니다.</p>
        )}
      </WarmCard>
      <WarmCard className="office-side-card office-flow-card">
        <p className="text-sm font-semibold">데이터 흐름</p>
        <p className="mt-2 text-sm text-pretty text-ink-soft">업무방 → 회의방 → 업무방 흐름은 shared_items와 meeting_imports로 추적됩니다.</p>
      </WarmCard>
    </div>
  );
}

function Action({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Button asChild variant="secondary" className="justify-start">
      <a href={href}>
        {icon}
        {label}
      </a>
    </Button>
  );
}
