export type ToolRisk = "low" | "medium" | "high";
export type JsonSchemaObject = Record<string, unknown>;

export type ToolDefinition = {
  name: string;
  description: string;
  risk: ToolRisk;
  writes: boolean;
  inputSchema: JsonSchemaObject;
};

export const toolRegistry: ToolDefinition[] = [
  {
    name: "read_room_summary",
    description:
      "Read the current SchoolX room memory summary, decisions, active tasks, key facts, and pending context. Use this before answering questions that require room history or standing project context.",
    risk: "low",
    writes: false,
    inputSchema: objectSchema({
      room_id: stringProperty("Room ID to read. Defaults to the current room when omitted."),
    }),
  },
  {
    name: "write_room_summary",
    description:
      "Propose a change to the room memory summary. This does not directly overwrite memory; it creates a review item for an administrator to inspect.",
    risk: "high",
    writes: true,
    inputSchema: objectSchema(
      {
        room_id: stringProperty("Room ID whose memory should be updated. Defaults to the current room when omitted."),
        summary: stringProperty("Proposed replacement or addition for the room summary."),
        reason: stringProperty("Why this memory update is useful and what conversation evidence supports it."),
      },
      ["summary", "reason"],
    ),
  },
  {
    name: "search_room_messages",
    description:
      "Search recent messages in an authorized SchoolX room. Use this when you need exact prior discussion, decisions, or bot/human messages instead of relying only on the startup context.",
    risk: "medium",
    writes: false,
    inputSchema: objectSchema({
      room_id: stringProperty("Room ID to search. Defaults to the current room when omitted."),
      query: stringProperty("Case-insensitive text to search for. Leave empty to return recent messages."),
      limit: numberProperty("Maximum messages to return, from 1 to 50. Defaults to 10."),
    }),
  },
  {
    name: "list_room_files",
    description:
      "List files available to an authorized SchoolX room, including file IDs and session mountPath values. If a file is mounted in the current session, read it directly from mountPath before answering document/PDF questions.",
    risk: "medium",
    writes: false,
    inputSchema: objectSchema({
      room_id: stringProperty("Room ID whose files should be listed. Defaults to the current room when omitted."),
      limit: numberProperty("Maximum files to return, from 1 to 50. Defaults to 20."),
    }),
  },
  {
    name: "read_room_file",
    description:
      "Read and extract text from an authorized SchoolX room file via the backend. Use this whenever mountPath is missing/unreadable or before answering questions about uploaded PDFs, text files, CSV, JSON, or markdown. Prefer file_id from list_room_files.",
    risk: "medium",
    writes: false,
    inputSchema: objectSchema({
      room_id: stringProperty("Room ID whose file should be read. Defaults to the current room when omitted."),
      file_id: stringProperty("File ID from list_room_files. Preferred."),
      filename: stringProperty("Exact file name to read when file_id is not known."),
      max_chars: numberProperty("Maximum extracted characters to return, from 1000 to 30000. Defaults to 16000."),
    }),
  },
  {
    name: "create_decision",
    description:
      "Record a concrete decision in a SchoolX room so it appears in the Decisions panel. Use when the user says something has been decided, asks to record a decision, or the meeting reaches an explicit conclusion.",
    risk: "medium",
    writes: true,
    inputSchema: objectSchema(
      {
        room_id: stringProperty("Room ID where the decision belongs. Defaults to the current room when omitted."),
        title: stringProperty("Short decision title."),
        description: stringProperty("Decision details, rationale, or relevant context."),
        source_message_id: stringProperty("Optional message ID that supports this decision."),
      },
      ["title"],
    ),
  },
  {
    name: "share_item_to_meeting",
    description:
      "Share a message or file from a work room into the main meeting room. Use only when the user asks to share or when a work-room result clearly needs meeting-room visibility.",
    risk: "high",
    writes: true,
    inputSchema: objectSchema(
      {
        source_room_id: stringProperty("Work room ID where the item originates. Defaults to the current room when omitted."),
        source_message_id: stringProperty("Optional room message ID to share."),
        source_file_id: stringProperty("Optional file ID to share."),
        title: stringProperty("Short title shown in the meeting room."),
        summary: stringProperty("Concise explanation of what is being shared and why it matters."),
      },
      ["title", "summary"],
    ),
  },
  {
    name: "import_meeting_item_to_room",
    description:
      "Import a meeting-room item back into a work room as pending context. Use when a main meeting decision or shared item needs follow-up by a specific room.",
    risk: "high",
    writes: true,
    inputSchema: objectSchema(
      {
        target_room_id: stringProperty("Work room ID that should receive the meeting context."),
        shared_item_id: stringProperty("Optional shared item ID from the meeting room."),
        source_message_id: stringProperty("Optional meeting-room message ID to import."),
        source_file_id: stringProperty("Optional file ID to import."),
        summary: stringProperty("Short explanation of what should be carried into the target room."),
      },
      ["target_room_id"],
    ),
  },
  {
    name: "create_task_from_decision",
    description:
      "Create a SchoolX task from a decision or actionable next step. Use when a conversation has a concrete owner, follow-up, due date, or work item.",
    risk: "medium",
    writes: true,
    inputSchema: objectSchema(
      {
        room_id: stringProperty("Room ID where the task belongs. Defaults to the current room when omitted."),
        decision_id: stringProperty("Optional decision ID this task came from."),
        title: stringProperty("Task title, short and action-oriented."),
        description: stringProperty("Task details, acceptance criteria, or context."),
        assignee_room_id: stringProperty("Optional room ID responsible for doing the work."),
        due_at: stringProperty("Optional ISO-8601 due date/time."),
      },
      ["title"],
    ),
  },
  {
    name: "propose_memory_write",
    description:
      "Propose structured long-term memory for administrator review. Use for durable facts, conventions, recurring decisions, or preferences that should survive future sessions.",
    risk: "high",
    writes: true,
    inputSchema: objectSchema(
      {
        room_id: stringProperty("Room ID that should own this memory. Defaults to the current room when omitted."),
        proposed_memory: {
          type: "object",
          description: "Structured memory patch. Keep it small, factual, and supported by conversation evidence.",
        },
      },
      ["proposed_memory"],
    ),
  },
];

export function getManagedAgentToolConfigs() {
  return [
    {
      type: "agent_toolset_20260401",
      default_config: {
        permission_policy: { type: "always_allow" },
      },
    },
    ...toolRegistry.map((tool) => ({
      type: "custom",
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    })),
  ];
}

function objectSchema(properties: Record<string, unknown>, required: string[] = []) {
  return {
    type: "object",
    properties,
    required,
  };
}

function stringProperty(description: string) {
  return { type: "string", description };
}

function numberProperty(description: string) {
  return { type: "number", description };
}
