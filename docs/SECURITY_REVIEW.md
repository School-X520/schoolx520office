# Security Review

## Implemented

- Service role, Anthropic, Google, and Zoom secrets are server-only.
- `host_url` is stripped from normal video meeting API responses.
- Room APIs call `requireUser` and room membership helpers.
- Mock and real Agent adapters are behind a server-only adapter boundary.
- Agent tool registry records audit logs and avoids direct DB access.
- RLS policies scope room messages, memories, files, shared items, meeting imports, video meetings, decisions, and tasks.

## Before Production

- Replace mock service paths with Supabase-backed mutations where needed.
- Confirm Google OAuth token storage policy.
- Confirm Zoom SDK host role issuance policy.
- Review school/student privacy policy before enabling transcript or AI summary.
- Run Supabase local reset and generated type checks.

## Later Improvements

- Add webhook-based Google Meet participant/artifact sync.
- Add background jobs for file checksum and virus scanning.
- Add rate limits for agent runs and video meeting creation.
