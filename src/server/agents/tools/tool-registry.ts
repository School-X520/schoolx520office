import "server-only";

export type ToolRisk = "low" | "medium" | "high";

export type ToolDefinition = {
  name: string;
  description: string;
  risk: ToolRisk;
  writes: boolean;
};

export const toolRegistry: ToolDefinition[] = [
  { name: "read_room_summary", description: "방 요약을 읽습니다.", risk: "low", writes: false },
  { name: "write_room_summary", description: "방 요약 변경을 제안합니다.", risk: "high", writes: true },
  { name: "search_room_messages", description: "방 메시지를 검색합니다.", risk: "medium", writes: false },
  { name: "list_room_files", description: "방 파일 목록을 읽습니다.", risk: "medium", writes: false },
  { name: "share_item_to_meeting", description: "회의방으로 항목을 공유합니다.", risk: "high", writes: true },
  { name: "import_meeting_item_to_room", description: "회의방 항목을 업무방으로 가져옵니다.", risk: "high", writes: true },
  { name: "create_task_from_decision", description: "결정사항에서 할 일을 만듭니다.", risk: "medium", writes: true },
  { name: "propose_memory_write", description: "장기 기억 쓰기를 리뷰 큐로 제안합니다.", risk: "high", writes: true },
];
