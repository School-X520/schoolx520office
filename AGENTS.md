# AGENTS.md

## Project

School-X 교사연구회 AI Office는 교사 연구회용 AI 협업 사무실이다. 현재 활성 방은 재무, 기획, 대외협력, 개발, 연구, 홍보, 경기도교육연구회, 광주하남교육연구회, 과학관 AI교육 연구회, 메인 회의방이다. 시교육연구회 방은 비활성 상태로 보관하며, 필요할 때 이름을 바꿔 다시 활성화한다.

각 업무방에는 도메인 봇 1개가 붙는다. 메인 회의방에는 상주 봇이 없고, 필요할 때 업무방 봇을 게스트로 호출한다.

## Architecture

- 방은 Supabase에 저장되는 영구 작업공간이다.
- Claude Managed Agents session은 앱의 `agent_runs`, `agent_run_events`로 추적하는 임시 실행 단위다.
- `sessions`라는 테이블명은 사용하지 않는다.
- Supabase `domain_memory`는 앱 표시/검색용 요약 캐시다.
- Claude Memory Store는 에이전트 장기 기억이다.
- `shared_items`는 업무방에서 회의방으로 공유한 객체다.
- `meeting_imports`는 회의방에서 업무방으로 가져간 객체다.
- 파일은 `files`, `file_versions`, `file_derivations`, `file_room_access`로 관리한다.
- 화상회의는 Google Meet 링크형을 기본으로 하고 Zoom embed는 명시적 플래그로만 켠다.

## Security

- `SUPABASE_SERVICE_ROLE_KEY`를 클라이언트 코드에 노출하지 않는다.
- Anthropic, Google, Zoom API 호출은 서버에서만 수행한다.
- 모든 room API route는 사용자 인증과 `room_memberships` 권한 검사를 수행한다.
- public schema의 사용자 접근 테이블은 RLS를 활성화한다.
- 에이전트는 Supabase DB에 직접 접근하지 않고 백엔드 custom tool wrapper만 사용한다.
- 학생 개인정보나 민감 데이터가 들어올 수 있으므로 주요 write 작업은 `audit_logs`에 남긴다.

## Development

- TypeScript strict를 유지한다.
- 서버 컴포넌트, server action/API route, 클라이언트 컴포넌트의 책임을 분리한다.
- 도메인 로직은 `src/server` 또는 서버 전용 `src/lib` 아래에 둔다.
- UI 컴포넌트는 `src/components` 아래에 둔다.
- DB 타입은 `src/types/database.ts` 또는 Supabase generated types로 관리한다.
- 작업 후 `pnpm lint`, `pnpm typecheck`, `pnpm test`, 가능하면 `pnpm build`를 실행한다.
