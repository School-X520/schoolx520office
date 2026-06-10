import { AlertTriangle, Bot, Database, ScrollText, Video } from "lucide-react";
import { WarmCard } from "@/components/layout/WarmCard";
import { StatusPill } from "@/components/layout/StatusPill";
import { Button } from "@/components/ui/button";
import { agentRunStatusLabel } from "@/lib/status-labels";
import type { AgentRun, AuditLog, MemoryWriteReview } from "@/types/domain";

export function OpsDashboard({
  agentRuns,
  auditLogs,
  memoryReviews,
}: {
  agentRuns: AgentRun[];
  auditLogs: AuditLog[];
  memoryReviews: MemoryWriteReview[];
}) {
  const failed = agentRuns.filter((run) => run.status === "failed");
  const requiresAction = agentRuns.filter((run) => run.status === "requires_action");
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-balance">운영/감사 대시보드</h1>
        <p className="text-sm text-pretty text-ink-soft">개발부서가 에이전트 실행, 메모리 리뷰, 감사 로그와 위험 신호를 확인합니다.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Metric icon={<Bot className="size-4" />} label="에이전트 실행" value={agentRuns.length} />
        <Metric icon={<AlertTriangle className="size-4" />} label="실패" value={failed.length} />
        <Metric icon={<Database className="size-4" />} label="조치 필요" value={requiresAction.length} />
        <Metric icon={<ScrollText className="size-4" />} label="메모리 검토 대기" value={memoryReviews.filter((review) => review.status === "pending").length} />
      </div>
      <WarmCard>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Google Meet 자동 링크</p>
            <p className="mt-1 text-sm text-pretty text-ink-soft">관리자 Google 계정을 연결하면 회의 시작 시 Meet 주소가 자동으로 등록됩니다.</p>
          </div>
          <Button asChild variant="secondary" className="w-full sm:w-fit">
            <a href="/api/integrations/google/connect">
              <Video className="size-4" />
              Google 연결
            </a>
          </Button>
        </div>
      </WarmCard>
      <WarmCard>
        <p className="mb-3 text-sm font-semibold">최근 agent_runs</p>
        <div className="space-y-2">
          {agentRuns.slice(0, 8).map((run) => (
            <div key={run.id} className="rounded-md border border-line bg-white/35 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="truncate text-sm font-medium">{run.agentId ?? "agent"} · {run.roomId}</p>
                <StatusPill tone={run.status === "failed" ? "terracotta" : "neutral"}>{agentRunStatusLabel(run.status)}</StatusPill>
              </div>
              <p className="mt-1 text-xs text-ink-soft">{run.mode} · {run.runType}</p>
            </div>
          ))}
          {!agentRuns.length ? <p className="text-sm text-ink-soft">아직 실행 기록이 없습니다.</p> : null}
        </div>
      </WarmCard>
      <WarmCard>
        <p className="mb-3 text-sm font-semibold">최근 audit_logs</p>
        <div className="space-y-2">
          {auditLogs.slice(0, 10).map((log) => (
            <div key={log.id} className="rounded-md border border-line bg-white/35 p-3 text-sm">
              <p className="font-medium">{log.action}</p>
              <p className="text-xs text-ink-soft">{log.roomId ?? "global"} · {new Date(log.createdAt).toLocaleString("ko-KR")}</p>
            </div>
          ))}
          {!auditLogs.length ? <p className="text-sm text-ink-soft">아직 감사 로그가 없습니다.</p> : null}
        </div>
      </WarmCard>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <WarmCard>
      <div className="flex items-center justify-between">
        <span className="text-sage">{icon}</span>
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
      </div>
      <p className="mt-2 text-sm text-ink-soft">{label}</p>
    </WarmCard>
  );
}
