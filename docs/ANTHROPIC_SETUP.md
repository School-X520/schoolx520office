# Anthropic Setup

Required env:

```env
ANTHROPIC_API_KEY=
ANTHROPIC_BETA_HEADER=managed-agents-2026-04-01
ENABLE_REAL_AGENTS=true
```

The app stores Anthropic agent/environment IDs in `agents` and memory store IDs in `room_memory_stores`.

Use:

```bash
pnpm agents:provision --dry-run
pnpm agents:provision
```

The current real adapter is isolated behind the adapter boundary and returns setup-required output until Managed Agents resources and exact SDK calls are confirmed.
