# Agent Tools

Agents cannot access Supabase directly. They can only call server wrappers:

- `read_room_summary`: read only, low risk
- `write_room_summary`: proposes summary changes, high risk
- `search_room_messages`: read scoped room messages, medium risk
- `list_room_files`: read scoped files, medium risk
- `share_item_to_meeting`: write, high risk
- `import_meeting_item_to_room`: write, high risk
- `create_task_from_decision`: write, medium risk
- `propose_memory_write`: review queue only, high risk

All write tools must validate `agent_run_id`, room scope, file/message access, and write an audit log.
