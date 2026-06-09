# AI Agent Handoff Status

Last updated: 2026-05-10 KST

This document summarizes the current implementation state of `School-X 교사연구회 AI Office` so another AI agent can continue the project without re-discovering the setup. Do not paste secrets into this file. Runtime secrets live only in ignored local or deployment environment variables.

## Project Summary

`School-X 교사연구회 AI Office` is a Next.js App Router application for a teacher research-group AI office.

The office has 10 active rooms and 1 inactive placeholder room:

- `meeting`: 메인 회의방, no resident bot
- `finance`: 재무
- `planning`: 기획
- `external`: 대외협력
- `development`: 개발
- `research`: 연구
- `promotion`: 홍보
- `province_research`: 경기도교육연구회
- `gwangju_hanam_research`: 광주하남교육연구회
- `science_museum`: 과학관 AI교육 연구회
- `city_research`: 비활성 프로젝트방, hidden until it is renamed and reused

Each active non-meeting room has one domain bot. The meeting room calls room bots as guests when needed. Agent runtime sessions are tracked in `agent_runs` and `agent_run_events`; do not introduce a `sessions` table.

## Repository State

- Repo path: `/Users/kim-yonghun/Development/SchoolX`
- Remote: `https://github.com/School-X520/schoolx520office.git`
- Branch: `main`
- Git user configured locally: `DevYonghunT <devyongt@gmail.com>`
- Latest pushed commits:
  - `7d7f8ec Add admin user and membership controls`
  - `4ea1e59 Grant admins room memberships`
  - `5415b5c Redirect unauthenticated workspace requests`
  - `ef023e4 Add Supabase-backed data and auth flow`
  - `afc557d Initial AI Office implementation`

`/.env.local` exists locally and is ignored by git. It contains real Supabase values and `NEXT_PUBLIC_USE_MOCK_DATA=false`. Never commit it.

## Runtime Stack

- Next.js 16 App Router
- TypeScript strict
- Tailwind CSS
- Supabase Auth/Postgres/Storage
- Vitest + Testing Library
- Playwright smoke tests
- Mock agent adapter by default
- Real Claude Managed Agent adapter only when `ENABLE_REAL_AGENTS=true` and `ANTHROPIC_API_KEY` are configured

Common commands:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
pnpm exec next start -p 3137
```

Current local URL:

```text
http://localhost:3137
```

## Environment

Required local/deployment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_USE_MOCK_DATA=false
SUPABASE_SERVICE_ROLE_KEY=

APP_URL=http://localhost:3137

ENABLE_REAL_AGENTS=false
ANTHROPIC_API_KEY=
ANTHROPIC_BETA_HEADER=managed-agents-2026-04-01

GOOGLE_MEET_ENABLED=false
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

ZOOM_ENABLED=false
ZOOM_CLIENT_ID=
ZOOM_CLIENT_SECRET=
ZOOM_ACCOUNT_ID=
ZOOM_MEETING_SDK_KEY=
ZOOM_MEETING_SDK_SECRET=
NEXT_PUBLIC_ENABLE_ZOOM_EMBED=false
```

Security notes:

- `SUPABASE_SERVICE_ROLE_KEY` must never be used in client code.
- Anthropic, Google, and Zoom secrets must stay server-side.
- `.env.local` and all `.env*` are ignored.
- A Supabase DB password and service-role key were used during setup; rotate them before serious production use.

## Supabase State

Supabase project ref:

```text
dgkmqguobwihyqxtuijh
```

Applied migrations:

- `0001_initial_schema.sql`
- `0002_rls_policies.sql`
- `0003_seed_base_data.sql`
- `0004_video_meetings.sql`
- `0005_auth_onboarding.sql`
- `0006_admin_room_memberships.sql`

Created Storage bucket:

```text
workspace-files
```

Seeded first admin allowed user:

```text
school.x520@gmail.com
```

Verified DB state:

- `user_profiles` contains `school.x520@gmail.com`
- that profile has `is_admin=true`
- that profile has `admin` membership in all 10 rooms
- REST reads for `rooms`, `agents`, `domain_memory`, `allowed_users`, and `video_meeting_providers` succeeded

Important migrations behavior:

- `0005_auth_onboarding.sql` creates auth onboarding for approved users.
- `0006_admin_room_memberships.sql` updates onboarding so approved admins receive `admin` membership for every active room.
- Non-admin approved users receive `member` access to `meeting` only by default.

## Auth State

Google OAuth is configured through Supabase Auth.

Google Cloud OAuth settings used:

- Authorized JavaScript origin:

```text
http://localhost:3137
```

- Authorized redirect URI:

```text
https://dgkmqguobwihyqxtuijh.supabase.co/auth/v1/callback
```

Supabase Auth URL settings should include:

- Site URL:

```text
http://localhost:3137
```

- Redirect URL:

```text
http://localhost:3137/auth/callback
```

Observed status:

- Google login succeeded.
- Unauthenticated `/office`, `/rooms/*`, `/admin`, `/admin/ops` redirect to `/login`.
- `/auth/login` redirects to Supabase Google OAuth.

## Implemented App Surfaces

Routes:

- `/login`
- `/office`
- `/rooms/[roomId]`
- `/admin`
- `/admin/ops`

Main API routes:

- `/api/admin/allowed-users`
- `/api/admin/memberships`
- `/api/rooms/[roomId]/messages`
- `/api/rooms/[roomId]/agent-runs`
- `/api/files`
- `/api/files/[id]/download`
- `/api/files/[id]/versions`
- `/api/shared-items`
- `/api/meeting-imports`
- `/api/decisions`
- `/api/tasks`
- `/api/video-meetings`
- `/api/video-meetings/[id]`
- `/api/video-meetings/[id]/artifacts`
- `/api/video-meetings/[id]/end`
- `/api/video-meetings/[id]/summarize`
- `/api/video-meetings/zoom/signature`

UI status:

- `/office` has no left workroom navigation; the office floor plan is widened.
- “오늘의 운영 상태” was moved into the right-side panel area.
- `/office` uses a viewport-fit layout so the current monitor does not get unnecessary vertical scroll.
- `/admin` now has real controls for:
  - adding allowed users
  - marking allowed users as admin
  - granting/removing room memberships for existing user profiles
- File upload/download controls exist in room side panels.

## Data Layer

Mock data remains available for fallback and testing.

Switching rule:

- `shouldUseMockData()` returns true when `NEXT_PUBLIC_USE_MOCK_DATA=true` or Supabase service-role setup is incomplete.
- Real mode uses `src/server/data/supabase-store.ts`.
- Mock mode uses `src/server/data/mock-store.ts`.

Primary real store:

```text
src/server/data/supabase-store.ts
```

Core server service files:

- `src/server/rooms/get-room-view.ts`
- `src/server/messages/room-message-service.ts`
- `src/server/collaboration/share-import-service.ts`
- `src/server/files/file-service.ts`
- `src/server/memory/domain-memory-service.ts`
- `src/server/audit/audit-service.ts`
- `src/server/agents/run-agent.ts`
- `src/server/agents/finalize-agent-run.ts`
- `src/server/agents/tools/execute-tool.ts`
- `src/lib/video-meetings/service.ts`
- `src/lib/video-meetings/permissions.ts`

All room-changing APIs should continue to enforce:

- `requireUser()`
- `requireRoomMember()` or admin check
- audit log writes for important mutations

## Agent Status

Agent adapter files:

- `src/server/agents/mock-agent-adapter.ts`
- `src/server/agents/claude-managed-agent-adapter.ts`
- `src/server/agents/get-agent-adapter.ts`

Current behavior:

- `MockAgentAdapter` is the default.
- Real Claude adapter is selected only if `ENABLE_REAL_AGENTS=true` and `ANTHROPIC_API_KEY` exists.
- The real adapter is still a setup-required skeleton, not a complete Claude Managed Agents implementation.
- Agent DB access should remain restricted to custom backend tool wrappers, not direct Supabase access.

Memory rules:

- Supabase `domain_memory` is app display/search cache.
- Claude Memory Store is intended for long-term agent memory, but actual Claude Memory Store provisioning is not done.

## Video Meeting Status

Implemented:

- Video meeting schema and RLS
- `google_meet` and `zoom` provider rows
- Google Meet link-style provider skeleton
- Zoom embed gating by flags
- Meeting artifacts/events tables and APIs
- Summary/artifact service skeletons

Current limitations:

- Google Meet API is not fully wired with real OAuth credentials.
- Zoom embed is off unless both `ZOOM_ENABLED=true` and `NEXT_PUBLIC_ENABLE_ZOOM_EMBED=true`.
- Meeting summary uses current app/agent flow and mock fallback unless provider integrations are completed.

## Verification Already Run

Recent successful checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Earlier smoke E2E also passed in mock mode:

```bash
pnpm test:e2e
```

After real auth was enabled, unauthenticated workspace requests were verified to redirect to `/login`.

## Known Gaps / Next Work

Recommended next steps, in order:

1. Log in locally and manually verify `/office`, `/admin`, and a few `/rooms/*` pages using the real Supabase session.
2. Test real room message creation in multiple rooms and confirm `room_messages` plus `audit_logs` entries.
3. Test file upload/download against `workspace-files`; confirm object appears in Supabase Storage and metadata appears in `files`, `file_versions`, `file_room_access`.
4. Test share/import flows:
   - workroom to meeting via `shared_items`
   - meeting to workroom via `meeting_imports`
   - pending context appended to target `domain_memory`
5. Make the meeting-room buttons for `@봇 호출` and `내 작업 공유` functional; currently they are visible controls but not complete workflows.
6. Add richer admin controls:
   - deactivate allowed user
   - promote/demote admin after profile exists
   - list user display names beside emails
7. Complete real Claude Managed Agents integration:
   - environment/agent provisioning
   - event streaming
   - event persistence in `agent_run_events`
   - Memory Store writes through approved review flow
8. Complete Google Meet provider:
   - Google OAuth connection for meeting creation
   - Meet space creation
   - artifact import/sync
9. Add/refresh E2E tests for real-mode redirects and admin UI. Avoid depending on a live Google OAuth browser login in CI; use mocks or controlled sessions.
10. Before production, rotate secrets and update deployment env vars in Vercel or the chosen host.

## Operational Notes For Next Agent

- Prefer existing patterns over new abstractions.
- Do not create a `sessions` table.
- Do not expose `host_url`, service-role key, Anthropic key, Google secret, or Zoom secret to client responses.
- Do not revert `.env.local`; it is intentionally ignored.
- Use `rg` for searches.
- Use `apply_patch` for code edits.
- Run at least `pnpm lint`, `pnpm typecheck`, and relevant tests after changes.
- If committing, keep using the existing `main` branch unless the user asks for a branch.
