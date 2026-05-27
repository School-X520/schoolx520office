"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { WarmCard } from "@/components/layout/WarmCard";
import { StatusPill } from "@/components/layout/StatusPill";
import type { OperationStatusSnapshot } from "@/types/domain";

export function OperationStatusCard({ initialStatus }: { initialStatus: OperationStatusSnapshot }) {
  const [status, setStatus] = useState(initialStatus);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function refreshStatus() {
      try {
        const response = await fetch("/api/office/operation-status", { cache: "no-store" });
        const payload = (await response.json()) as {
          status?: OperationStatusSnapshot;
        };
        if (!cancelled && response.ok && payload.status) {
          setStatus(payload.status);
          setHasError(false);
        } else if (!cancelled) {
          setHasError(true);
        }
      } catch {
        if (!cancelled) {
          setHasError(true);
        }
      }
    }

    const timer = window.setInterval(refreshStatus, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

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
        <StatusPill tone={hasError ? "neutral" : "sage"}>{hasError ? "확인 필요" : "자동 갱신"}</StatusPill>
      </div>
      <dl className="office-status-metrics mt-4 grid grid-cols-3 gap-2 text-center">
        <Metric label="공유" value={status.sharedCount} />
        <Metric label="브리핑" value={status.briefingCount} />
        <Metric label="할 일" value={status.taskCount} />
      </dl>
      <p className="mt-3 text-xs text-ink-soft">최근 갱신 {formatUpdatedAt(status.updatedAt)}</p>
    </WarmCard>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="office-metric-card rounded-md border border-line bg-card/80 px-2 py-3 shadow-sm">
      <dt className="text-xs font-medium text-ink-soft">{label}</dt>
      <dd className="office-metric-value mt-1 text-2xl font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
}

function formatUpdatedAt(value: string) {
  return new Date(value).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
