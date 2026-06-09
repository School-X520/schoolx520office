import "server-only";

import type { AgentRun, AgentRunActivity, AgentRunEvent } from "@/types/domain";

export const AGENT_RUN_PROGRESS_EVENT = "schoolx.agent_run.progress";

export function agentRunProgressPayload(input: { key: string; title: string; detail?: string | null }) {
  return {
    key: input.key,
    title: input.title,
    detail: input.detail ?? null,
  };
}

export function publicAgentRunActivity(run: AgentRun, events: AgentRunEvent[]): AgentRunActivity[] {
  const progress = new Map<string, AgentRunActivity>();
  const orderedEvents = [...events].sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  for (const event of orderedEvents) {
    if (event.eventType !== AGENT_RUN_PROGRESS_EVENT) {
      continue;
    }

    const payload = event.payload;
    const title = typeof payload.title === "string" ? payload.title.trim() : "";
    if (!title) {
      continue;
    }

    const key = typeof payload.key === "string" && payload.key ? payload.key : event.id;
    const detail = typeof payload.detail === "string" && payload.detail.trim() ? payload.detail.trim() : null;
    progress.set(key, {
      id: `${event.id}-${key}`,
      title,
      detail,
      status: "completed",
      createdAt: event.createdAt,
    });
  }

  const items = [...progress.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  if (!items.length) {
    items.push(defaultActivityForRun(run));
  }

  const terminal = terminalActivityForRun(run);
  if (terminal && !items.some((item) => item.title === terminal.title)) {
    items.push(terminal);
  }

  const activeStatus = activityStatusForRun(run);
  return items.map((item, index) => ({
    ...item,
    status: index === items.length - 1 ? activeStatus : "completed",
  }));
}

function defaultActivityForRun(run: AgentRun): AgentRunActivity {
  return {
    id: `${run.id}-queued`,
    title: "실행 요청 접수",
    detail: null,
    status: "pending",
    createdAt: run.startedAt,
  };
}

function terminalActivityForRun(run: AgentRun): AgentRunActivity | null {
  const createdAt = run.endedAt ?? new Date().toISOString();
  if (run.status === "completed") {
    return {
      id: `${run.id}-completed`,
      title: "응답 완료",
      detail: null,
      status: "completed",
      createdAt,
    };
  }
  if (run.status === "cancelled") {
    return {
      id: `${run.id}-cancelled`,
      title: "실행 중단됨",
      detail: cancelledDetail(run),
      status: "cancelled",
      createdAt,
    };
  }
  if (run.status === "failed") {
    return {
      id: `${run.id}-failed`,
      title: "실행 실패",
      detail: run.error ?? "오류 내용을 확인하지 못했습니다.",
      status: "failed",
      createdAt,
    };
  }
  return null;
}

function activityStatusForRun(run: AgentRun): AgentRunActivity["status"] {
  if (run.status === "completed") {
    return "completed";
  }
  if (run.status === "failed") {
    return "failed";
  }
  if (run.status === "cancelled") {
    return "cancelled";
  }
  if (run.status === "queued") {
    return "pending";
  }
  return "running";
}

function cancelledDetail(run: AgentRun) {
  const cancelledAt = run.metadata.cancelledAt;
  return typeof cancelledAt === "string" ? `중단 시각 ${formatKoreanTime(cancelledAt)}` : null;
}

function formatKoreanTime(value: string) {
  return new Date(value).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
