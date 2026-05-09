import Link from "next/link";
import { Activity, Bot, ClipboardList, FilePlus2, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WarmCard } from "@/components/layout/WarmCard";
import { StatusPill } from "@/components/layout/StatusPill";
import { VideoMeetingPanel } from "@/components/video-meetings/VideoMeetingPanel";
import type { SharedItem, VideoMeeting } from "@/types/domain";

export function MeetingSidePanel({
  sharedItems,
  activeMeeting,
}: {
  sharedItems: SharedItem[];
  activeMeeting?: VideoMeeting | null;
}) {
  return (
    <div className="office-side-panel flex h-full min-h-0 flex-col gap-4">
      <OperationStatusCard />
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
      <VideoMeetingPanel activeMeeting={activeMeeting ?? null} compact />
      <WarmCard className="office-side-card office-recent-card">
        <p className="mb-3 text-sm font-semibold">최근 공유 카드</p>
        <div className="space-y-2">
          {(sharedItems.length ? sharedItems : mockShared()).slice(0, 3).map((item) => (
            <div key={item.id} className="rounded-md border border-line bg-white/35 p-3">
              <p className="line-clamp-1 text-sm font-medium">{item.title}</p>
              <p className="office-recent-summary line-clamp-2 text-xs text-ink-soft">{item.summary}</p>
            </div>
          ))}
        </div>
      </WarmCard>
      <WarmCard className="office-side-card office-flow-card">
        <p className="text-sm font-semibold">데이터 흐름</p>
        <p className="mt-2 text-sm text-pretty text-ink-soft">업무방 → 회의방 → 업무방 흐름은 shared_items와 meeting_imports로 추적됩니다.</p>
      </WarmCard>
    </div>
  );
}

function OperationStatusCard() {
  return (
    <WarmCard className="office-status-card border-sage/35 bg-gold-soft/70 shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-base font-semibold">
            <Activity className="size-4 text-sage" />
            오늘의 운영 상태
          </p>
          <p className="office-status-copy mt-1 text-sm text-pretty text-ink-soft">회의방으로 모인 흐름과 남은 작업을 빠르게 확인합니다.</p>
        </div>
        <StatusPill tone="sage">Live</StatusPill>
      </div>
      <dl className="office-status-metrics mt-4 grid grid-cols-3 gap-2 text-center">
        <Metric label="공유" value="3" />
        <Metric label="브리핑" value="2" />
        <Metric label="할 일" value="5" />
      </dl>
    </WarmCard>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="office-metric-card rounded-md border border-line bg-card/80 px-2 py-3 shadow-sm">
      <dt className="text-xs font-medium text-ink-soft">{label}</dt>
      <dd className="office-metric-value mt-1 text-2xl font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
}

function Action({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Button asChild variant="secondary" className="justify-start">
      <Link href={href}>
        {icon}
        {label}
      </Link>
    </Button>
  );
}

function mockShared(): SharedItem[] {
  return [
    {
      id: "mock-shared-1",
      sourceRoomId: "finance",
      targetRoomId: "meeting",
      title: "예산 가능성 검토",
      summary: "과학관 과제 예산 범위와 증빙 필요 항목을 확인해야 합니다.",
      createdAt: new Date().toISOString(),
      sharedBy: null,
      sourceMessageId: null,
      sourceFileId: null,
      metadata: {},
    },
  ];
}
