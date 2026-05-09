# Implementation Plan

## Stack

- Next.js App Router, TypeScript strict, Tailwind CSS v4
- Supabase Auth, Postgres, RLS, Storage, Realtime
- Claude Managed Agents adapter with mock fallback
- Google Meet link provider and optional Zoom Meeting SDK skeleton
- Vitest, Testing Library, Playwright

## Structure

- `src/app`: routes and API handlers
- `src/components`: layout, office, rooms, meeting, files, agents, admin, video meeting UI
- `src/server`: auth, room, message, collaboration, file, agent, memory, audit services
- `src/lib`: env, Supabase clients, video meeting providers, utilities
- `supabase/migrations`: schema, RLS, seed, video meeting extension

## Implementation Order

1. Project scaffold and env handling
2. Supabase schema/RLS/seed
3. Auth and allowed user guard
4. Office map and room workspace UI
5. Messages, share/import, files, decisions, tasks
6. Mock Agent adapter, memory service, tool registry
7. Real adapter/provisioning skeleton
8. Video meeting schema, service, UI, summarizer flow
9. Admin/ops dashboard
10. Tests, security review, deployment docs, final QA

## API Routes

- `/api/admin/allowed-users`
- `/api/admin/memberships`
- `/api/rooms/[roomId]/messages`
- `/api/rooms/[roomId]/agent-runs`
- `/api/shared-items`
- `/api/meeting-imports`
- `/api/files/[id]/download`
- `/api/files/[id]/versions`
- `/api/decisions`
- `/api/tasks`
- `/api/video-meetings/*`

## RLS Strategy

RLS helpers are `is_admin`, `is_room_member`, `is_room_admin`, and `can_access_file`. Browser reads are membership-scoped. Writes that affect permissions, files, agents, memory, audit, or external providers go through server-side wrappers.

## Tests

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. E2E smoke tests use mock mode so missing external keys do not block local verification.
