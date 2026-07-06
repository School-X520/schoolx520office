import "server-only";

import { shouldUseMockData } from "@/lib/env";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";
import { fetchOpsCountsViaRpc } from "@/server/rooms/page-view";
import type { OperationStatusSnapshot } from "@/types/domain";

export async function getOperationStatus(userId: string): Promise<OperationStatusSnapshot> {
  // 실 모드: 당일/멤버십 스코프 count 집계 1왕복(rpc_ops_counts).
  // v1은 agent_runs·tasks 전테이블을 스캔해 역사가 쌓일수록 저하됐다(계획 1.2 MAJOR).
  if (!shouldUseMockData()) {
    return fetchOpsCountsViaRpc(userId);
  }

  const source = shouldUseMockData() ? mockStore : supabaseStore;
  const [memberships, sharedItems, agentRuns, tasks] = await Promise.all([
    shouldUseMockData()
      ? Promise.resolve(mockStore.listMemberships().filter((membership) => membership.userId === userId))
      : supabaseStore.listMemberships(userId),
    source.listSharedItems("meeting"),
    source.listAgentRuns(),
    source.listTasks(),
  ]);
  const accessibleRoomIds = new Set(memberships.map((membership) => membership.roomId));
  const todayKey = seoulDateKey(new Date());

  return {
    sharedCount: sharedItems.filter((item) => seoulDateKey(item.createdAt) === todayKey).length,
    briefingCount: agentRuns.filter((run) => {
      const isMeetingBriefing = run.mode === "meeting_guest" || run.runType === "meeting_guest";
      return (
        isMeetingBriefing &&
        run.status === "completed" &&
        accessibleRoomIds.has(run.roomId) &&
        seoulDateKey(run.startedAt) === todayKey
      );
    }).length,
    taskCount: tasks.filter((task) => {
      const isActive = task.status !== "done" && task.status !== "cancelled";
      return isActive && (accessibleRoomIds.has(task.roomId) || (task.assigneeRoomId ? accessibleRoomIds.has(task.assigneeRoomId) : false));
    }).length,
    updatedAt: new Date().toISOString(),
  };
}

function seoulDateKey(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}`;
}
