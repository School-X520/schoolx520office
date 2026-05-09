import { agents } from "@/lib/mock-data";

export const agentConfig = agents.map((agent) => ({
  id: agent.id,
  roomId: agent.roomId,
  name: agent.name,
  defaultModel: agent.defaultModel,
  systemPrompt: agent.systemPrompt,
  guestPrompt: agent.guestPrompt,
  tools: [
    "read_room_summary",
    "search_room_messages",
    "list_room_files",
    "share_item_to_meeting",
    "import_meeting_item_to_room",
    "create_task_from_decision",
    "propose_memory_write",
  ],
}));
