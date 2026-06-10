# School-X 교사연구회 AI Office — 전체 프로젝트 리뷰

- **리뷰 일자**: 2026-06-10 (작업 트리 기준: main, 미커밋 변경 10개 파일 + 신규 1개 포함)
- **리뷰 방법**: 6개 전문 트랙(아키텍처 / 보안 / 데이터베이스 / 코드 품질 / 프론트엔드 / 테스트·운영)을 독립 심층 분석 후 교차 검증·통합. `pnpm typecheck`·`pnpm lint`·`pnpm test` 실측 포함. 39개 API 라우트 전수 조사, 16개 마이그레이션 전수 정독.
- **규모**: 158 TS/TSX 파일, ~17.9k LOC, Next.js 16.2.6 / React 19.2.4 / Supabase / Claude Managed Agents

---

## 1. 종합 평가

> **종합 6.2 / 10 — "설계 규율은 우수한 프로토타입, 운영 준비는 미달."**

| 영역 | 점수 | 한 줄 평 |
|---|---|---|
| 아키텍처 | 6.5 | 모듈 경계·어댑터 패턴은 우수하나 데이터 계층이 full-table-scan 기반이라 확장성 천장이 낮음 |
| 보안 | 6.5 | 라우트 인증/인가 적용률은 매우 높으나, 무인증 디버그·Zoom 서명·RLS 무력화 등 "켜지면 안 되는 것"이 켜져 있음 |
| 데이터베이스 | 6.5 | 핫패스 인덱스·타입 선택은 정확하나 RLS가 형식적 장식이고 토큰 평문 저장 |
| 코드 품질 | 7.5 | typecheck/lint 무오류, `any` 0건, TODO 0건. 스토어 드리프트와 4중 중복 로직이 감점 |
| 프론트엔드 | 6.0 | 토큰 규율·IME 처리·a11y 기초는 탄탄하나 실시간 수신 불가 + 디자인 문서-코드 불일치 |
| 테스트/운영 | 4.0 | 59/59 테스트 통과하지만 전부 mock 모드. CI·모니터링·rate limit·복구 장치 전무 |

**핵심 진단 3가지:**

1. **이 제품의 가장 큰 리스크는 코드가 아니라 운영 구성이다.** env 하나만 빠져도 운영 도메인이 "로그인 없이 들어가지는 가짜 데이터 앱"으로 조용히 전환되고(P0-1), 무인증 디버그 엔드포인트가 상시 노출되며(P0-2), CI·모니터링이 없어 이런 사고를 감지할 수단도 없다.
2. **방어선이 한 겹뿐이다.** 모든 DB 접근이 service-role(RLS 우회)이고, 정성껏 작성한 RLS 정책은 런타임에 단 한 번도 평가되지 않는다. 앱 레벨 `requireRoomMember` 검사를 한 곳이라도 빠뜨리면 즉시 연구회 간 데이터 격리가 붕괴한다 — 학생/교사 PII가 들어올 수 있는 도메인에서 다층방어 부재는 구조적 약점이다.
3. **"AI 협업 사무실"의 핵심인 다자 실시간 협업이 실제로 동작하지 않는다.** 다른 사용자의 메시지는 새로고침 전까지 보이지 않고, 채팅 폴링은 매초 agent_runs 전체 테이블을 내려받는다. 방 50개/유저 500명 규모가 되기 전에 반드시 해결해야 한다.

**잘하고 있는 것** (유지할 것): `server-only` 경계 규율(클라이언트 번들로 새는 서버 코드 0건), 에이전트 도구 실행의 호출자 권한 재검증(프롬프트 인젝션으로 타 방 침범 차단 — 가장 잘 설계된 부분), 일관된 audit_logs, `jsonOk`/`jsonError` 응답 통일, IME 조합 입력 처리, 행위 중심 단위 테스트 설계, 의존성 위생(메이저 뒤처짐 0).

---

## 2. P0 — 치명 (즉시 조치, 8건)

### P0-1. env 누락 시 운영 환경이 조용히 mock 모드(사실상 인증 우회)로 전환
- **위치**: `src/lib/env.ts:73-75`, `src/server/auth/get-current-user.ts:21-23`
- **증거**: `shouldUseMockData()`는 `NEXT_PUBLIC_USE_MOCK_DATA==="true"` **또는 서비스 롤 키/URL 미설정**이면 true. env 스키마는 전 항목 `optional()`이라 누락돼도 빌드·부팅 성공. mock 모드의 `getCurrentUser()`는 무조건 가짜 "총괄 관리자"를 반환.
- **영향**: Vercel env 오타/누락 하나로 운영 도메인이 로그인 없는 가짜 앱으로 배포된다. 장애가 아니라 "정상처럼 보이는 잘못된 서비스"라 감지가 어렵다.
- **수정**: production(`VERCEL_ENV`)에서 mock 폴백 금지 + 필수 env를 zod `required`로 부팅 시 검증해 throw. `.env.example` 기본값 `NEXT_PUBLIC_USE_MOCK_DATA=true`도 재고.

### P0-2. 무인증 디버그 노출 2곳 — `/api/auth/debug` + `/auth/status`
- **위치**: `src/app/api/auth/debug/route.ts:11-67`, `src/app/auth/status/page.tsx`
- **증거**: 인증 가드·환경 분기 전혀 없음. 로그인 이메일, Supabase project ref, sb-* 쿠키 이름 전체, 내부 authError 메시지를 반환/렌더.
- **영향**: 인프라 정찰 표면 + 교육 도메인 운영 서비스에 상시 노출되는 것 자체가 컴플라이언스 리스크.
- **수정**: production에서 404 또는 `requireAdmin()` 게이트. email은 boolean 플래그로 축소.

### P0-3. Zoom SDK 서명을 임의 `meetingNumber`에 검증 없이 발급
- **위치**: `src/app/api/video-meetings/zoom/signature/route.ts:6-22`
- **증거**: `requireUser()`만 통과하면 어떤 meetingNumber로도 HMAC 서명 발급. `video_meetings` 레코드·room 멤버십과 대조하지 않음. (role은 0으로 강제되어 호스트 상승만 차단된 상태.)
- **영향**: 우리 SDK 키로 보호되는 임의 Zoom 회의 참가 서명 무한 발급 — SDK 키 남용·타 회의 무단 입장.
- **수정**: meetingNumber → `video_meetings` 조회 → `requireRoomMember(meeting.roomId)` 강제 + 형식 검증.

### P0-4. RLS 사실상 무력화 — 전 쿼리 service-role + `is_room_member`의 meeting 전역 통과
- **위치**: `src/server/data/supabase-store.ts:90-96`(`db()` = admin client), `supabase/migrations/0002_rls_policies.sql:10-18`
- **증거**: 모든 데이터 접근이 service-role(RLS 무조건 우회)로 수행 → 35개 테이블의 RLS 정책이 런타임에 한 번도 평가되지 않음. 게다가 `is_room_member()`에 `OR rid = 'meeting'`이 있어 RLS를 켜도 인증만 된 사용자(비활성/비승인 포함)가 메인 회의방 전체를 열람 가능. 다수 테이블은 SELECT 정책만 있고 INSERT/UPDATE/DELETE 정책 부재라 "RLS 실효화" 전환 경로도 막혀 있음.
- **영향**: 다중 연구회 데이터 격리가 100% 앱 코드 규율에 의존. 한 곳의 검사 누락 = 즉시 격리 붕괴.
- **수정**: (단기) `OR rid='meeting'` 제거 + "RLS는 현재 비활성 방어"임을 명문화 + 모든 진입점의 `requireRoomMember` 강제 테스트. (중기) 사용자 컨텍스트 쿼리를 anon+JWT 클라이언트로 전환하고 쓰기 정책 보강.

### P0-5. OAuth refresh token 평문 저장 (`integration_tokens`)
- **위치**: `supabase/migrations/0016_integration_tokens.sql:1-17`, `src/server/integrations/google-oauth.ts:54-63`, `supabase-store.ts:1788-1804`
- **증거**: refresh/access token을 가공 없이 text 컬럼에 저장. pgcrypto는 활성화돼 있으나 미사용. RLS 정책 0개(service-role 전용 — 이 부분은 의도면 OK이나 주석 없음).
- **영향**: DB 백업·콘솔·키 유출 시 사실상 무기한 Google 계정 접근권 탈취(Calendar/Meet 스코프).
- **수정**: pgsodium/Supabase Vault 또는 AES-256-GCM(별도 키) 봉투 암호화. service-role 전용임을 정책 주석으로 명시.

### P0-6. 데이터 계층 전반이 full-table-scan — 단건 조회조차 전체 테이블 로드
- **위치**: `src/server/agents/run-agent.ts:524-526`(`listAgentRuns().find()`), `finalize-agent-run.ts:10`, `tools/execute-tool.ts:15`, `api/rooms/[roomId]/agent-runs/[runId]/route.ts:17`, `supabase-store.ts:1270-1288, 1472-1475`(listMessages/listAgentRuns — WHERE·limit 없음)
- **증거**: 채팅 폴링(1초 간격)이 매번 **agent_runs 전체**를 받아 메모리에서 1건을 찾는다. 스트림 이벤트마다 호출되는 `assertAgentRunActive`도 동일. `getRoomView`는 매 요청 `listMemberships()`(전체)·`listUserProfiles()`(전체)·스레드 전체 메시지를 로드.
- **영향**: run/메시지 누적에 비례해 모든 요청 비용이 선형 증가. Supabase egress·DB CPU가 가장 먼저 터지는 1순위 확장성 천장.
- **수정**: `getAgentRun(runId)` 등 단건 조회 메서드(`.eq().maybeSingle()`) 추가, `listMessages`/`listAgentRuns`에 limit + keyset 페이지네이션, 프로필 조회는 `IN (...)` 단일 쿼리로.

### P0-7. mock-store ↔ supabase-store 공유 인터페이스 부재 — 12개 메서드 드리프트
- **위치**: `src/server/data/mock-store.ts` vs `supabase-store.ts`, 분기 지점 57곳/30파일
- **증거**: supabase에만 존재: `createFileVersion`, `getIntegrationToken`, `upsertIntegrationToken`, `ensureUserProfile`, `updateUserAdminByEmail`, `upsertAllowedUser`, `grantAllRoomMemberships`, `listPendingRoomMembershipsFromAudit`. mock에만 존재: `currentUser`, `removeFileFromRoom`, `grantFileAccess`, `listVideoEvents`. coordinator 메타데이터 변환도 supabase-store에만 있어(1395-1404) 양 모드 저장 결과가 다를 수 있음.
- **영향**: 한쪽에만 메서드 추가 시 컴파일은 통과하고 다른 모드에서 `is not a function` 런타임 크래시. mock에서 통과한 코드가 real에서만 깨짐(또는 반대).
- **수정**: `interface DataStore` 선언 + 양쪽에 `satisfies DataStore` 강제. 분기는 `getDataStore()` 단일 팩토리로 흡수.

### P0-8. 채팅이 다른 사용자의 메시지를 수신하지 못함 (실시간/폴링 부재)
- **위치**: `src/components/rooms/RoomChat.tsx:41`, `src/components/realtime/RoomPresence.tsx`(stub)
- **증거**: `useState(initialMessages)` 이후 메시지 목록 구독·폴링이 전혀 없음. 자기가 띄운 agent run만 폴링. Supabase Realtime 구독 코드는 코드베이스 어디에도 없음(`RoomPresence`는 "Realtime mock" 라벨만 렌더).
- **영향**: 같은 방의 다른 구성원 메시지·다른 사람이 호출한 봇 응답은 **F5 전까지 절대 나타나지 않음**. 협업 도구로서 제품 성립을 가르는 결함.
- **수정**: Supabase Realtime(`room_messages` postgres_changes) 구독 도입, 폴링은 fallback. `initialMessages` 갱신분을 `mergeMessages`로 합류.

---

## 3. P1 — 높음 (운영 투입 전 필수)

### 보안/인증
| # | 발견 | 위치 | 요지 |
|---|---|---|---|
| 1 | 세션 서명 키가 service-role 키로 폴백 + `secure` 플래그 누락 | `src/server/auth/app-session.ts:40-46, 102-108` | `APP_SESSION_SECRET ?? SUPABASE_SERVICE_ROLE_KEY` — 그런데 `APP_SESSION_SECRET`은 `.env.example`·env 스키마에 아예 없어 사실상 항상 마스터 키가 세션 서명에 재사용됨. 키 회전이 세션 무효화와 결합. 독립 시크릿 필수화 + `secure: production` 추가 |
| 2 | middleware가 no-op — Supabase 세션 갱신·1차 게이트 부재 | `middleware.ts:3-9`, `src/lib/supabase/server.ts:18-26` | `@supabase/ssr` 표준 `updateSession` 패턴 부재. 서버 컴포넌트의 `setAll`은 조용히 삼켜짐 → 토큰 만료 시 비결정적 인증 실패(현재는 7일 app-session이 가림). 신규 보호 라우트의 가드 누락 시 막아줄 방어선도 없음 |
| 3 | 마이그레이션에 실명 이메일 PII·비즈니스 데이터 하드코딩 | `0010_seed_devyongt_admin.sql:3`, `0003`, `0014`, `0011` | `devyongt@gmail.com`이 VCS에 영구 박제. 시드는 `seed.sql`/env 부트스트랩으로 분리, 관리자 이메일은 외부 주입 |
| 4 | `docs/AGENT_HANDOFF_STATUS.md`에 인프라 식별 정보 + "키 로테이션" 자체 경고 미이행 | docs/ | Supabase ref, 관리자 이메일, OAuth URL 평문. 문서 정리 + 로테이션 실행 |
| 5 | rate limiting 전무 (에이전트 실행·업로드·Zoom 서명·회의 생성) | 전역 (grep 0건) | 인증된 1인이 Anthropic 비용 무제한 소진 가능. per-user 제한 + 방당 동시 run 1개 + 일일 토큰 예산 알림 |

### 안정성/성능
| # | 발견 | 위치 | 요지 |
|---|---|---|---|
| 6 | stuck run 복구 장치 없음 + `maxDuration=60` 충돌 | `api/.../agent-runs/route.ts:6,33-39`, adapter `:23`(55s) | 함수 강제 종료 시 run이 `running`으로 영구 고착. sweeper(cron/lazy) + maxDuration 상향(Fluid 300s+) 또는 큐 이관. AbortController가 인메모리 Map이라 다중 인스턴스에서 취소 신호 유실(`run-agent.ts:59`) |
| 7 | agent_runs 상태 전이 비원자 (TOCTOU) | `run-agent.ts:169-186`, `supabase-store.ts:1452-1470` | read-check-write 패턴 — 동시 트리거 시 중복 실행·이중 과금. `UPDATE ... WHERE status='queued' RETURNING *` 낙관적 락 + 부분 unique 인덱스 |
| 8 | `getRoomView` 매 요청 14쿼리 + 전역 풀로드 + (미커밋) backfill 동기 await | `get-room-view.ts:35-37, 61-84`, `development-request-mirror.ts:148-173` | 개발방 진입마다 최대 300회 직렬 쿼리 backfill이 렌더를 블로킹(결과는 사용도 안 함). 신규 run 시점 미러로 한정하거나 `after()` 이관 |
| 9 | FK/역방향 인덱스 누락 9건+ | `0001_initial_schema.sql:279-287` | `room_memberships(room_id)`, `agent_runs(initiated_by, agent_id)`, `room_messages(agent_run_id)`, `agent_tool_calls(agent_run_id)`, `decisions(room_id)`, `shared_items(source_room_id)`, `file_derivations(*)` 등 |
| 10 | 무한 증가 테이블 보존 정책 부재 | `agent_run_events`, `audit_logs`, `room_messages` | 파티셔닝/보존 잡 없음. events 90일·audit 1년 등 정책 수립 + pg_cron |
| 11 | `finalizeAgentRun`이 매 실행마다 무의미한 고정 keyFact 무한 누적 | `finalize-agent-run.ts:28-34` | "최근 봇 실행 결과가 반영되었습니다" fact가 봇 호출마다 영구 추가 → 에이전트 프롬프트 토큰 비용 직결. 즉시 제거 + 상한/중복제거 |

### 품질/프론트엔드
| # | 발견 | 위치 | 요지 |
|---|---|---|---|
| 12 | CI/CD 전무 | `.github/` 없음 | 깨진 커밋이 그대로 prod 배포 가능. Actions 1개(lint→typecheck→test→build) + Vercel 게이트 |
| 13 | 실운영 경로 무테스트 | `supabase-store.ts`(2,053줄), auth 계열, API 라우트 39개 전부 0건 | 테스트 59개가 전부 mock 모드만 검증. supabase 계약 테스트(동일 시나리오 양 스토어) 최소 핵심 메서드부터 |
| 14 | `database.ts`가 생성 타입이 아닌 stub | `src/types/database.ts:9-28` | 실제 20+ 테이블 중 2개만, 그것도 `Record<string, Json>`. supabase-store가 `as unknown as LooseDb` + 수동 매핑 ~700줄. `supabase gen types`로 교체 |
| 15 | error.tsx / not-found.tsx / global-error.tsx 전무 | `src/app` | 서버 에러·잘못된 roomId 시 영문 기본 화면. 한국어 에러/404 + 복구 동선 추가 |
| 16 | "최신 활동만 표시" 로직 4중 중복 + 죽은 CSS | `agent-run-activity.ts:57`, `MessageBubble.tsx:271`, `RoomChat.tsx:308`, `globals.css:133-146` | CSS 블록은 같은 diff에서 `<ol>`이 제거되어 **머지 시점부터 데드 코드**. 서버 한 곳(`slice(-1)`)만 남기고 정리 |
| 17 | 공통 Dialog 비제어 전용 → Radix 모달 6곳 복붙 + 오버레이 색 드리프트 | `ui/dialog.tsx` vs `DecisionTaskPanel` 외 5곳 | `open/onOpenChange` 지원 추가 후 회수. `bg-black/35` vs `bg-ink/35` 통일 |
| 18 | 메시지 타임라인 강제 스크롤 | `MessageTimeline.tsx:31-38` | 과거 메시지 읽는 중에도 새 메시지마다 최하단 점프. "하단 근접 시에만 + 새 메시지 배지" 패턴으로 |
| 19 | 디자인 시스템 3원 불일치 + Pretendard 미로딩 | `globals.css:35`, `layout.tsx` | CLAUDE.md(Navy/Gold ↔ 순백/뉴트럴 — 문서 자체도 상호 모순) vs 실제 코드(sage/terracotta/크림 paper). Pretendard 참조 0건, Inter도 미로드 → OS 폰트 폴백. 문서 또는 코드 한쪽으로 정합화 + next/font(local)로 실제 로드 |
| 20 | mock 요소 프로덕션 노출 | `RoomPresence.tsx:6`("Realtime mock" 라벨), `MeetingSidePanel.tsx:42`(가짜 카드 폴백), `RoomCard.tsx:11`(`onlineCount=1` 고정) | 제품 신뢰도 직결. 제거 또는 빈 상태 UI로 대체 |

---

## 4. P2 — 중간 (계획적 개선)

1. **Zod 입력 검증 미적용** — 39개 라우트 중 `profile`만 Zod, 나머지는 `request.json() as {...}` 타입 단언. 배열 길이 상한 부재(amplification 벡터). 라우트별 `safeParse` 도입.
2. **`jsonError`가 5xx 내부 메시지 그대로 노출** (`src/lib/api.ts:7-14`) — Supabase 에러·경로 노출. 500은 일반 문구 + 서버 로그.
3. **파일 업로드 크기/MIME 화이트리스트 부재** (`api/files/route.ts`, `file-service.ts:171-224`) — 현재 Vercel 4.5MB 한도가 우연한 방어막. pdf-parse CPU DoS 표면 포함.
4. **coordinator briefing·operation-status의 멤버십 스코핑 명시 검증 필요** — 비멤버 방 요약 간접 열람 가능성.
5. **회의 생성 권한 느슨** (`permissions.ts:13-19` — observer만 차단) + artifacts `externalUrl` 미검증(저장형 오픈 리다이렉트).
6. **스키마 누락을 에러 문자열 매칭으로 폴백** (`supabase-store.ts:105-144`) + briefing을 `audit_logs`에 우겨넣는 폴백 — audit 무결성 오염. 마이그레이션을 배포 전제로 강제.
7. **`src/lib`에 서버 도메인 로직 혼재** (`lib/video-meetings/service.ts`, `lib/agents/*`) — "도메인은 전부 `src/server`" 규칙으로 단순화.
8. **라우트가 스토어 직접 호출** (`agent-runs/[runId]` GET, `decisions` 등) — 서비스 함수로 추출, 라우트는 얇은 어댑터로.
9. **`as Error & { status }` 17회 복붙** — `HttpError` 클래스/팩토리로 치환.
10. **거대 파일** — supabase-store 2,053줄(도메인별 분할), file-service 831줄, run-agent 680줄.
11. **SSR/CSR 시간대 불일치** — `toLocaleTimeString("ko-KR")` 5곳 중복, `timeZone: "Asia/Seoul"` 명시한 공용 유틸로(하이드레이션 미스매치 방지).
12. **관리자 페이지 JSX props 순차 await 워터폴** (`admin/page.tsx:30-35`) — `Promise.all`로.
13. **내부 네비게이션 `<a href>`/`window.location`** 3곳 — `next/link`/`router.push`로.
14. **메시지 무제한 로드 + MessageBubble 내 O(메시지×목록) find** — 최근 50건 + 상위 Map 인덱싱.
15. **관측성 부재** — Sentry, `/api/health`(DB ping + mock 모드 여부), agent 실패율 집계.
16. **E2E 스모크 3건뿐 + `reuseExistingServer: true` 무조건** — "미인증 리다이렉트"·"mock 봇 응답" 2개 시나리오 추가, CI에선 build+start.
17. **`.env.example` ↔ `env.ts` ↔ SETUP.md 불일치** — `GOOGLE_MEET_ACCESS_TOKEN`/`APP_SESSION_SECRET` 누락 등. env.ts를 단일 진실원으로.
18. **타임아웃 시 영문 원시 에러 노출** — AbortError → "시간 초과" 한글 매핑. 55s 상한을 env 설정화.
19. **문서 부패** — `AGENT_HANDOFF_STATUS.md`(어댑터를 "미완성 스켈레톤"으로 기술 — 실제는 완성), 마이그레이션 0006까지로 기술(실제 16개). 갱신 또는 삭제.
20. **`getRoomView`의 `memory!` non-null 단언** — `getMemory`는 null 반환 가능. 계약 정리.
21. **미커밋 diff 회귀 2건** — `MessageBubble.tsx:233-243` fallback `createdAt: ""`(기존엔 ISO 시각 — 정렬/표시 오염 위험), `share-import-service.ts:267` `Map.get() as FileRecord` 무가드 캐스팅.

## 5. P3 — 개선 권장 (요약)

- 채팅 입력기 a11y(textarea aria-label, 에러 role="alert", auto-grow) / 터치 타깃 24~28px(모바일 44px 권장 미달)
- 한국어 UI에 영문 상태값 노출("done", "processed", "agent_runs" 등) — `statusLabel` 매핑 모듈 1개
- 데드 코드: `BotMentionPicker.tsx`(import 0곳), `ZoomMeetingEmbed` 플레이스홀더, `generateStaticParams`+`force-dynamic` 모순(mockStore 결합 — 빌드 산출물이 실데이터와 무관)
- `displayRoomName` 2벌 발산, MessageComposer 전송 함수 2벌 — 통합
- 폴링이 탭 비가시 상태에서도 지속(15초 × 2곳) — visibilitychange 일시정지
- `user_profiles.email` unique/lower 인덱스 부재 / `video_meetings.host_url` 컬럼 분리 권장 / events 인덱스 DESC vs 조회 ASC 불일치
- vitest 전역 jsdom(환경 셋업 57.86s) — 서버 테스트는 node 환경 분리 / mockStore `reset()` 부재(순서 의존 위험)
- `.gitignore`의 `.env*`가 `.env.example`까지 포섭 — `!.env.example` 예외
- 헤더(1500px)/본문(1780px) 최대폭 불일치, 스켈레톤 animate-pulse 누락
- 기능 플래그 평가 경로 3원화(`getServerEnv` vs `process.env` 직접 vs 미검사) — 단일 경유 강제
- tool dispatch 11개 if-체인 + registry inputSchema가 런타임 강제력 없음 — Map 디스패치 + `schema.parse`
- React 19 신기능(useOptimistic/useActionState/Server Actions) 미활용 — 폼 계열 보일러플레이트 감소 기회

---

## 6. AGENTS.md 보안 불변식 검증 결과

| 불변식 | 판정 | 근거 |
|---|---|---|
| 1. service-role 키 클라이언트 비노출 | ✅ 준수 | import 6곳 전부 server-only 모듈. 단 세션 서명 폴백(P1-1)으로 키 재사용 리스크 |
| 2. Anthropic/Google/Zoom 서버 전용 호출 | ✅ 준수 | 단 Zoom 서명의 인가 검증 누락(P0-3) |
| 3. 모든 room API의 인증+멤버십 검사 | ⚠️ 부분 위반 | 39개 중 `auth/debug`(인증 자체 없음), `zoom/signature`(멤버십 없음) 2건 위반. 나머지 일관 적용 |
| 4. 사용자 접근 테이블 RLS 활성화 | ⚠️ 형식적 준수 | 35개 테이블 전부 활성이나 service-role로 전부 우회(P0-4) + meeting 구멍 + 쓰기 정책 부재 |
| 5. 에이전트는 tool wrapper만 사용 | ✅ 모범 준수 | 호출자 권한 재검증 + run 스코프 제한 — 가장 잘 설계된 부분 |
| 6. 주요 write의 audit_logs 기록 | ✅ 대체로 준수 | 메시지/스레드 생성만 미기록(경미) |

## 7. API 라우트 전수 조사 요약

39개 라우트 중 **인증 누락 1건**(`auth/debug`), **리소스 인가 누락 1건**(`zoom/signature`), Zod 검증 1건(`profile`)뿐 — 나머지는 인증·멤버십 일관 적용. 모범: `profile`(Zod), `files/share`(양방향 권한), `meeting-imports`(requireWritableImport 체인). 상세 표는 보안 트랙 원본 참조 — 핵심 패턴: `requireUser` → `requireRoomMember`/`canWriteRoom` → 서비스 위임 → `jsonOk/jsonError`.

## 8. 테스트 커버리지 갭 맵 (요약)

- **통과 실측**: 18파일 59 테스트 전부 통과 (15.6s). typecheck/lint 0 오류. `pnpm outdated` 메이저 뒤처짐 0.
- **치명 갭**: `supabase-store.ts`(실모드 데이터 계층 전체) ❌ / auth 계열(`app-session` HMAC 포함) ❌ / API 라우트 39개 ❌ / `managed-agents-api.ts`(SSE 파싱) ❌ / `file-service.ts` ❌
- **부분**: `run-agent`(start만, complete/취소/실패 ❌), `claude-managed-agent-adapter`(리소스 빌드만)
- **양호**: development-mirror(7 시나리오), video-meeting-service(폴백·경계값), persona/share-import/coordinator/memory/threads/tool-registry

---

## 9. 실행 로드맵

### Phase 0 — 보안 핫픽스 (반나절~1일) — ✅ 2026-06-10 코드 적용 완료
> 잔여 수동 작업: ① Vercel에 `APP_SESSION_SECRET` 환경 변수 추가(미설정 시 프로덕션 부팅 실패 — 의도된 fail-fast), ② `supabase db push`로 0017 마이그레이션 적용, ③ Supabase service role key·DB password 로테이션(git 히스토리에 project ref 잔존).
1. `/api/auth/debug`·`/auth/status` production 차단 (P0-2)
2. Zoom 서명에 회의·멤버십 검증 (P0-3)
3. production에서 mock 폴백 금지 + 필수 env fail-fast (P0-1)
4. `APP_SESSION_SECRET` 독립 시크릿 필수화 + 쿠키 `secure` (P1-1)
5. RLS `OR rid='meeting'` 제거 마이그레이션 (P0-4 단기)
6. `globals.css:133-146` 죽은 CSS 삭제 + diff 회귀 2건(`createdAt:""`, `Map.get as`) 수정
7. HANDOFF 문서 시크릿 정리 + 키 로테이션 실행 (P1-4)

### Phase 1 — 운영 안정화 (1~2주) — ✅ 완료 (2026-06-10, 커밋 719bb7b·026cb0d·d186db3·b2b6b5a·4987ffa·8075e6d·8e7ae8c)
1. ✅ 단건 조회 메서드(`getAgentRunById`) — 핫패스 4곳 full-scan 제거. listMessages 페이지네이션은 Realtime 작업과 함께 Phase 2로 (P0-6 부분)
2. ✅ `DataStore` 타입 + `getDataStore()` 팩토리 (P0-7) — supabaseStore를 진실원으로 파생, 팩토리 반환 타입이 mock 정합성을 컴파일 타임에 강제. drift 14건 정합화(누락 8 메서드 추가, 시그니처 정렬, mock update* throw 통일). addFile은 의도적 분기로 제외. 핵심 에이전트 흐름 3파일 마이그레이션 + 런타임 정합성 테스트
3. ✅ GitHub Actions CI(lint/typecheck/test/build) + packageManager 핀 (P1-12). Vercel "Require checks" 연결은 대시보드 수동 작업
4. ✅ stuck run sweeper(5분 타임아웃 자동 failed) + agent_runs 원자 전이(queued→running 조건부 UPDATE) (P1-6,7). maxDuration 상향/큐 이관은 Phase 3
5. ✅ rate limit — 방당 동시 활성 run 상한(3) + 좀비 제외, DB 기반 무인프라 (P1-5). 일일 토큰 예산 알림은 관측성(Sentry)과 함께 별도
6. ✅ integration_tokens 암호화 — AES-256-GCM + `INTEGRATION_TOKENS_ENC_KEY`, 평문 읽기 폴백(점진 마이그레이션) (P0-5)
7. ✅ FK 인덱스 9건(0018) + finalizeAgentRun keyFact 정리(중복제거+50개 상한) (P1-9,11)
8. ✅ middleware Supabase 세션 갱신(@supabase/ssr 공식 패턴, mock 모드 no-op, fail-open) (P1-2). 인증 리다이렉트 게이트는 페이지 레벨 유지(루프 방지). **배포 전 로그인 1회 라이브 검증 필요**
9. ✅ backfill 중복 쿼리 제거(후보당 2회→0회) (P1-8 부분). inline await는 backfill-on-view 설계/테스트상 유지
10. ✅ not-found/error/global-error 바운더리 + jsonError 위생(5xx 내부메시지 차단) + `/api/health` (P1-15, P2). Sentry는 별도(의존성 추가 필요)

**Phase 1 완료.** 남은 보강(Phase 2/3 또는 후속): listMessages 페이지네이션(Realtime와 함께), Sentry 관측성, maxDuration/큐 이관, Vercel 머지 게이트 연결, P1-2 라이브 로그인 검증.

### Phase 2 — 제품 완성 (2~4주) — 🔄 진행 중 (2026-06-10, 커밋 cb7694f·3ed6573·d33c708·68341b7·8bfe6c5)
1. ✅ 채팅 교차 사용자 수신 + 스크롤 정책 + mock 요소 제거 (P0-8, P1-18,20). **Realtime 대신 폴링(4s, visibility-aware)** 채택 — RLS/publication 라이브 설정 불필요, service-role 메시지 API 재사용, graceful degradation. 스크롤은 하단 근접 시에만 자동 + "새 메시지" 배지. mock presence/onlineCount/가짜 공유카드 제거
2. ✅ Pretendard 실제 로드 (P1-19) — CDN(dynamic subset) + `--font-sans` 선두 교체. "디자인 시스템 정합화"의 팔레트 부분(warm vs Navy/Gold)은 시각 결정이 필요해 별도
3. 🔄 부분 — ✅ 영문 상태값 한글화(status-labels) (P3) / ⬜ Dialog 통합(P1-17, 6개 복붙 모달 → 제어형 공유 Dialog) — UI 거동 시각 검증 필요, 별도 / ⬜ a11y 보강
4. ⬜ DB 생성 타입 + 계약 테스트 + E2E (P1-13,14) — `supabase gen types`·계약 테스트·E2E 실행이 **라이브 Supabase/앱 구동 필요**, 별도 세션
5. ✅ Zod 입력 검증 (P2-1) — 고위험 6개 라우트(agent-runs·messages·tasks·decisions·meeting-imports·files/share)에 스키마 + 배열 상한(amplification 차단). 나머지 라우트는 점진 확대. 업로드 크기/MIME 제한(P2-3)은 별도
6. ⬜ 마이그레이션 PII 분리 + seed 체계 + 보존 정책 (P1-3,10) — 이미 적용된 마이그레이션 수정은 위험, forward 마이그레이션/seed 재설계로 신중히
7. ✅ HttpError 정리(P2-9) / ⬜ 라우트→서비스 위임·lib·server 경계(P2-7,8) — 점진

**Phase 2 잔여(별도 세션 권장):** Dialog 통합(시각 검증), DB 생성 타입·계약 테스트·E2E(라이브 환경), 마이그레이션 PII 분리(forward 마이그레이션), 라우트→서비스 위임 정리.

### Phase 3 — 스케일 대비 (50방/500유저 전)
1. 에이전트 실행 큐 기반 워커 이관 (`after()`+인메모리 Map 탈피)
2. RLS 실효화 — 사용자 컨텍스트 쿼리를 anon+JWT로, 쓰기 정책 보강
3. supabase-store 도메인별 분할 + 캐싱 전략(React.cache/unstable_cache)
4. agent_run_events/audit_logs 파티셔닝

---

*리뷰 트랙별 상세 원본(전수 조사표·증거 코드 포함)이 필요하면 각 트랙 보고서를 재생성할 수 있습니다. 본 문서는 6개 트랙의 교차 검증 통합본입니다.*
