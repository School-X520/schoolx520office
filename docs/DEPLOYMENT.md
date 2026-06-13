# Deployment

## Vercel

Set all values from `.env.example` in Vercel.

> **주의:** 프로덕션 런타임에서는 `NEXT_PUBLIC_USE_MOCK_DATA=true`가 **허용되지 않는다**.
> `src/lib/env.ts`의 가드(`shouldUseMockData`/`assertProductionEnv`)가 mock 폴백을 막고,
> 필수 env가 빠지면 부팅 시 throw 한다. mock 모드는 로컬/프리뷰에서 Supabase를 붙이기 전 단계에서만 쓴다.

프로덕션 필수 env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `APP_SESSION_SECRET`(독립 시크릿),
`INTEGRATION_TOKENS_ENC_KEY`(OAuth 토큰 암호화), 그리고 `ENABLE_REAL_AGENTS=true`면 `ANTHROPIC_API_KEY`.
좀비 run 정리 cron을 쓰려면 `CRON_SECRET`도 설정한다(`vercel.json`의 `/api/agent-runs/sweep`).

## Supabase

1. Create project.
2. Configure Google OAuth redirect URLs.
3. Run all migrations in numeric order (`supabase/migrations/0001` … 최신).
4. Create **private** Storage bucket `workspace-files` (공개 버킷 금지 — 파일은 서명 URL로만 접근).
5. Insert administrator email into `allowed_users`.

> **RLS 주의:** 현재 모든 DB 접근은 service-role 키로 수행되어 RLS를 우회한다.
> 따라서 정의된 RLS 정책은 런타임에 평가되지 않는 **휴면(dormant) 방어**이며,
> 실효 권한 경계는 앱 코드의 `requireUser` → `requireRoomMember`/`canWriteRoom` 검사다.
> "비관리 사용자로 RLS 검증"은 현재 아키텍처에선 의미가 없다(RLS를 실효화하려면
> 사용자 컨텍스트 쿼리를 anon+JWT 클라이언트로 전환해야 한다 — 로드맵 Phase 3).

## Anthropic

1. Add API key.
2. Confirm Managed Agents beta access.
3. Run provisioning dry-run.
4. Store returned IDs in `agents` and `room_memory_stores`.

## Video Meetings

Google Meet is link-based. Zoom embed remains disabled until security review is complete.
