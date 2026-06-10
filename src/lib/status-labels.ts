import type { AgentRunStatus, MeetingStatus, RoomType } from "@/types/domain";

// 한국어 서비스에서 원시 enum 값(영문)이 그대로 노출되지 않도록 라벨을 한 곳에서 관리한다.

export const roomTypeLabels: Record<RoomType, string> = {
  department: "업무방",
  project: "프로젝트방",
  meeting: "회의방",
};

export const taskStatusLabels: Record<"todo" | "doing" | "done" | "cancelled", string> = {
  todo: "할 일",
  doing: "진행 중",
  done: "완료",
  cancelled: "취소됨",
};

export const meetingImportStatusLabels: Record<"pending" | "processed" | "dismissed", string> = {
  pending: "대기",
  processed: "반영됨",
  dismissed: "보류",
};

export const agentRunStatusLabels: Record<AgentRunStatus, string> = {
  queued: "대기 중",
  running: "실행 중",
  requires_action: "추가 조치 필요",
  idle: "대기",
  completed: "완료",
  failed: "실패",
  cancelled: "취소됨",
};

export const meetingStatusLabels: Record<MeetingStatus, string> = {
  scheduled: "예정",
  live: "진행 중",
  ended: "종료",
  canceled: "취소",
  failed: "실패",
};

export function roomTypeLabel(type: RoomType): string {
  return roomTypeLabels[type] ?? type;
}

export function taskStatusLabel(status: "todo" | "doing" | "done" | "cancelled"): string {
  return taskStatusLabels[status] ?? status;
}

export function meetingImportStatusLabel(status: "pending" | "processed" | "dismissed"): string {
  return meetingImportStatusLabels[status] ?? status;
}

export function agentRunStatusLabel(status: AgentRunStatus): string {
  return agentRunStatusLabels[status] ?? status;
}
