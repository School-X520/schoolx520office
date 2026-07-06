# School-X v2 재구축 개발 계획 (2026-07-02)

> 전제: 현재 구현된 기능 전체(72개 유저 스토리)를 그대로 목표 기능으로 삼되,
> **"반응속도가 느리다"는 핵심 문제를 아키텍처 레벨에서 제거**하는 것을 최우선 설계 기준으로
> 처음부터 다시 설계·구현한다고 가정한 계획이다.
> 진단은 멀티에이전트 코드 분석(29개 에이전트, 병목 후보 20건 중 16건 코드 검증 확정)에 근거한다.

---

## 0. 요약

현재 사이트가 느린 이유는 프레임워크나 서버 성능이 아니라 **"Supabase 왕복(RTT) 횟수 × 직렬 실행 × 무제한 쿼리 × 폴링"의 곱셈 구조** 때문이다.

- 방 페이지 1회 렌더 = **약 21회의 Supabase HTTP 왕복이 약 7단계로 직렬 실행** (미들웨어 Auth 1 + 인증 2 + 권한 1 + 뷰 조립 ~17)
- 채팅은 4초마다 클라이언트당 **5회 직렬 쿼리 + 전체 메시지 히스토리 전송** (LIMIT 없음 — 대화가 쌓일수록 무한히 느려짐)
- 모든 뮤테이션 후 `router.refresh()` → **페이지 전체 쿼리(~18회) 재실행**이 저장 버튼의 체감 지연
- 함수 리전 미지정(vercel.json에 `regions` 없음) → 기본 iad1(미국 동부)일 가능성. 이 경우 RTT 1회당 ~180ms가 위 곱셈에 그대로 곱해짐

v2의 설계 목표는 단순하다: **페이지당 왕복 ≤3회, 요청당 인증 쿼리 0회, 폴링 0개, 뮤테이션 체감 0ms(낙관적), 봇 응답 스트리밍.**

---

## 1. 왜 느린가 — 코드 검증된 진단

### 1.1 구조적 3대 원인 (개별 버그가 아님)

| # | 구조적 원인 | 구체 증상 (검증 완료) |
|---|---|---|
| 1 | **RTT 증폭 데이터 계층** — 테이블별 SELECT * 후 JS에서 조인, 페이지네이션 전무 | `getRoomView` 18~20 RTT/7직렬단계, `listMessages`·`listAgentRuns`·`listTasks`·`listUserProfiles`·`listMemberships` 전테이블 스캔, `listThreads` 중복 실행, 개발방은 접속 시마다 인라인 backfill 배치(agent_runs 전체 스캔 + 순차 N+1) |
| 2 | **폴링 기반 "실시간"** — Supabase Realtime 미사용(클라이언트 코드가 데드 코드) | 채팅 4초 폴링(틱당 인증 2 + 멤버십 1 + 스레드 1 + 전체 메시지 1 = 5 직렬 쿼리), agent run 1~2초 폴링, 오피스에 15초 폴러 2개(그중 하나는 매번 agent_runs·tasks 전체 스캔) |
| 3 | **전량 재조회 뮤테이션** — 13개 컴포넌트가 `router.refresh()`로 무효화 | 결정/할일 저장 버튼이 "전체 페이지 재쿼리 완료"까지 저장 중 상태, 봇 응답 완료 때마다 페이지 전체 재조회, 낙관적 업데이트 0곳 |

### 1.2 개별 확정 병목 (v2 설계에 반영할 체크리스트)

- **[CRITICAL]** `listMessages` LIMIT 없음 — 페이지 로드·4초 폴·run 폴링 모두 전체 히스토리 조회
- **[CRITICAL]** 미들웨어가 매 네비게이션마다 `supabase.auth.getUser()` 네트워크 왕복 — 4b8fabc 커밋이 핫패스에서 제거한 Auth RTT를 미들웨어가 도로 추가
- **[CRITICAL]** 개발방 진입 시 인라인 미러 backfill (전체 run 스캔 + run당 스레드 전체 fetch 순차 루프)
- **[MAJOR]** 인증 프로필 조회가 직렬 2쿼리 (`allowed_users` → `user_profiles`) — 앱에서 가장 자주 실행되는 쿼리쌍
- **[MAJOR]** 메시지 전송 = 직렬 ~7 RTT (스레드 bump·감사 로그가 응답 크리티컬 패스에)
- **[MAJOR]** 파일 공유 = (방 × 파일)당 ~6 직렬 RTT — 5파일×3방 ≈ 90 RTT를 한 POST에서
- **[MAJOR]** 운영 상태 위젯 — 15초마다 agent_runs·tasks 전체 스캔 (역사가 쌓일수록 매주 느려짐)
- **[MAJOR]** Pretendard를 렌더 차단 CDN CSS로 로드 (next/font 미사용), next/image 미사용
- **[MAJOR]** 화상회의 AI 요약·페르소나 발행은 Anthropic 호출을 요청 안에서 동기 대기
- **[MINOR]** 폴 틱마다 메시지 배열 교체 → 타임라인 전체 리렌더 (memo 없음)
- **[P0 확인 필요]** Vercel 함수 리전 미지정 — Supabase 리전과의 물리 거리가 모든 RTT에 곱해짐

### 1.3 이미 문서화된 "후회한 결정" (v2에서 반복 금지)

1. **service-role 클라이언트 전면 사용** → 35개 테이블의 RLS가 장식. 격리 실수가 곧 P0 (06-13 리뷰에서 실제로 3건 발생)
2. **mock store / supabase store 이중 데이터 계층** (분기점 57곳) → 반복적 드리프트
3. **Realtime 대신 폴링 채팅** → 요청당 비용이 사용량·역사에 비례해 증가
4. Supabase 생성 타입 대신 수기 stub 타입, Storage 설정 버전관리 밖, 데스크톱 잔재 코드
5. 디자인 시스템 문서(CLAUDE.md)와 실제 코드 토큰 불일치 — 결정 없이 방치됨

---

## 2. v2 목표와 성능 예산

기능 목표: 현행 72개 유저 스토리 전부 (방 10개 오피스, 방별 상주봇+총괄봇+개발봇, 스레드 채팅, 파일/공유/반입, 결정/할일, 화상회의+AI요약, 관리자/운영, 승인 게이트 인증).

**성능 예산 (매 Phase의 완료 조건에 포함, CI에서 검증):**

| 지표 | 현재 (v1) | v2 목표 |
|---|---|---|
| 방 페이지 서버 데이터 조회 | ~21 RTT / ~7 직렬 단계 | **≤3 RTT / ≤2 단계** (RPC 1회 + 인증 0회) |
| 인증된 요청당 인증용 DB 쿼리 | 2~3회 직렬 | **0회** (서명 검증만) |
| 미들웨어 네트워크 호출 | 매 네비게이션 1회 | **0회** (만료 임박 시에만 갱신) |
| 채팅 수신 지연 | 최대 4초 (폴링) | **<1초** (Realtime push) |
| 채팅 유지 비용 | 클라이언트당 4초마다 5쿼리+전체 히스토리 | **0 쿼리** (구독) |
| 메시지 전송 체감 | ~7 직렬 RTT 완료까지 | **즉시 표시** (낙관적) + 서버 1 RPC |
| 뮤테이션 후 UI 반영 | 전체 페이지 재쿼리(~18쿼리) 대기 | **즉시** (낙관적/타깃 무효화), `router.refresh()` 사용 금지 |
| 봇 응답 | 완료까지 1~2초 폴링, 통짜 표시 | **토큰 스트리밍** (첫 토큰 <3초 목표) |
| 목록 쿼리 | LIMIT 없음 (무한 성장) | **전 쿼리 LIMIT+커서 기본값** (기본 50) |
| 오피스 상태 위젯 | 15초마다 전테이블 2개 스캔 | 당일 필터 집계 count 쿼리 or Realtime |
| 폰트/이미지 | 렌더 차단 CDN CSS | next/font/local + next/image |
| Lighthouse (모바일) | 미측정 | Performance ≥ 90 |

**리전 원칙 (P0):** Supabase 프로젝트 리전을 확인하고, Vercel 함수 리전을 같은 지역으로 고정한다
(서울 `ap-northeast-2` ↔ `icn1`). vercel.ts(권장) 또는 대시보드에서 명시 설정. 사용자·함수·DB가 모두 한국이면 RTT ~5-15ms, 미국 경유면 ~180ms — **이 설정 하나가 모든 지표에 10~30배로 곱해진다.**

---

## 3. 유지할 것 / 바꿀 것

### 유지 (재작성 리스크 > 이득)
- **스택**: Next.js 16 App Router + React 19 + Supabase + Tailwind v4 + Vercel. 느림의 원인은 스택이 아니라 접근 패턴이다. 스택 교체는 일정만 늘린다.
- **DB 스키마 골격**: ~30개 테이블 구조와 0018까지의 인덱스 설계는 건전. 정리·통합해서 v2 초기 마이그레이션으로 재사용.
- **도메인 로직**: 승인 게이트, hub-and-spoke 공유/반입 규칙, 에이전트 10개 커스텀 툴 정의, run 상태 머신(queued→running→…+좀비 sweep), 동시 실행 3개 캡.
- **테스트 자산**: 155개 vitest + 8개 Playwright 시나리오는 스펙 문서로 이식.
- **HMAC 앱 세션의 교훈**: "요청당 인증은 로컬 검증"이라는 방향은 옳았다 — v2에서 전면화.

### 교체 (아키텍처 결정 6개)

| v1 결정 | v2 결정 |
|---|---|
| 테이블별 다중 쿼리 + JS 조인 | **페이지당 1 RPC** (Postgres 함수가 뷰 전체를 JSON 1왕복으로 반환) |
| service-role 전면 + 앱 코드 권한 체크 | **RLS-first**: 사용자 JWT 스코프 클라이언트 기본, service-role은 백그라운드 작업 화이트리스트만 |
| 폴링 (4s/1s/15s) | **Supabase Realtime** (메시지·run 이벤트·상태 위젯 구독) |
| `router.refresh()` 전량 무효화 | **낙관적 업데이트 + 태그 단위 무효화** |
| mock store 이중 계층 | **로컬 Supabase(`supabase start`) + 시드 스크립트** — 단일 데이터 계층 |
| 수기 stub 타입 | **`supabase gen types` 생성 타입** + zod 경계 검증 |

---

## 4. 아키텍처 설계

### 4.1 데이터 계층 — "페이지당 1왕복"

- 읽기: 화면 단위 Postgres 함수(RPC)가 JSON 한 덩어리를 반환.
  - `rpc_office_view(user_id)` — 방·멤버십·에이전트·활성회의·공유함·당일 운영 카운트를 1왕복에
  - `rpc_room_view(room_id, thread_id, msg_limit=50)` — 방·스레드·최근 메시지 50·멤버·파일·공유·결정·할일을 1왕복에
  - `rpc_admin_view()`, `rpc_ops_view()` 동일 원칙
- 쓰기: 다단계 쓰기는 RPC 트랜잭션 1왕복. `rpc_send_message()`(insert+스레드 bump), `rpc_share_files(file_ids[], room_ids[])`(배치 insert). 감사 로그는 **트리거**로 — 응답 크리티컬 패스에서 제거.
- 모든 목록 함수 시그니처에 `limit`/`cursor` 필수 인자. LIMIT 없는 쿼리는 코드리뷰 리젝트 사유.
- 메시지 증분 조회: `?after=<created_at cursor>` 델타 전용 (Realtime 놓침 보정용).
- 무거운 백그라운드(개발봇 미러 backfill 등)는 **오직 cron/after()** — 페이지 렌더 경로 진입 금지.

### 4.2 인증 — "요청당 네트워크 0"

- Google OAuth via Supabase Auth + `allowed_users` 승인 게이트 유지.
- **Custom Access Token Hook**으로 역할(role)·승인상태·방 멤버십 요약을 JWT 클레임에 탑재
  → `requireUser`/`requireRoomMember`가 **서명 검증 + 클레임 읽기만**으로 동작 (DB 0회).
  멤버십 변경 시 세션 refresh 유도(버전 클레임)로 전파.
- 미들웨어: JWT `exp`를 로컬 디코드해 **만료 임박 시에만** 토큰 갱신. 평상시 네트워크 0.
- 프로필 표시 정보(이름·아바타)는 페이지 RPC 결과에 포함 — 별도 인증 체인 없음.

### 4.3 실시간 — "폴링 금지"

- `room_messages` insert → Realtime(Postgres Changes 또는 Broadcast) 구독으로 push. 수신 <1초.
- agent run 진행: `agent_run_events` insert를 방 채널에 broadcast → 폴링 2계통(1s run + 4s 메시지) 삭제.
- 운영 상태 위젯: 당일 집계 count 쿼리 1회 + 이벤트 구독. 15초 setInterval 삭제.
- 유일한 폴백: 탭 재활성화(visibilitychange) 시 델타 1회 조회. 상시 타이머는 금지.
- 규모 검증: 교사연구회 규모(동시 수십 명)는 Supabase Realtime 무료 티어로 충분.

### 4.4 렌더링 — "즉시 셸 + 스트리밍 + 낙관적"

- 서버 컴포넌트 유지하되 **Suspense 경계 분리**: 방 셸(헤더·입력창)은 즉시, 타임라인·우측 패널은 스트리밍. `loading.tsx` 단독 의존 탈피.
- 정적 데이터(방 정의·에이전트 페르소나 등 변경 드문 것)는 `'use cache'`/태그 캐시 — 매 요청 조회 금지.
- 뮤테이션: Server Actions + `revalidateTag` 세분화, 클라이언트 목록은 `useOptimistic`. **`router.refresh()` 전면 금지** (ESLint 규칙으로 차단).
- `next/font/local`로 Pretendard 셀프호스팅, 아바타는 `next/image`.
- 타임라인 `React.memo` + 동일 데이터 병합 시 참조 유지 (불필요 리렌더 제거).
- 디자인: CLAUDE.md 공통 원칙(순백/#f9fafb 뉴트럴, 카드 border-gray-200 + shadow-sm, 12~16px 라운딩, 분야별 색상 유지)을 **디자인 토큰 파일로 코드화**해 문서-코드 불일치를 구조적으로 해소.

### 4.5 AI 계층 — "절대 비차단 + 스트리밍"

- 현행 202+after() 구조 유지하되:
  - **모든** Anthropic 호출 비차단화 — v1에서 동기였던 화상회의 요약, 페르소나 발행도 202 + 백그라운드로.
  - 결과 폴링 → **SSE 스트리밍 라우트**: after()에서 소비하는 Anthropic 세션 이벤트를 `agent_run_events`에 쓰는 동시에 Realtime broadcast → 클라이언트는 토큰 단위로 표시.
  - 55초 타임아웃/60초 maxDuration 잔여 리스크: Fluid Compute 기본 300초 상향 + `requires_action` 재개 워커(v1 미구현 항목)를 cron에 추가.
- 좀비 run sweep cron, 방당 3개 동시 실행 캡, 도구 10종은 그대로 이식.

### 4.6 파일 — "서버 경유 제거"

- 업로드: Supabase Storage **signed upload URL로 브라우저 직행** (v1은 50MB를 Next 핸들러로 버퍼링).
- 다운로드: 300초 서명 URL 유지. 데스크톱 전용 로컬 실행 경로는 삭제 (문서화된 잔재).
- 방 간 복사: 바이트 왕복 대신 Storage `copy` API.
- Storage 버킷/정책을 마이그레이션으로 버전관리 (v1의 문서화된 결함).

### 4.7 개발 환경·품질 게이트

- `supabase start`(로컬 도커) + 시드 스크립트가 mock 모드를 대체. **분기 없는 단일 데이터 계층.**
- CI: lint / typecheck / vitest / Playwright + **성능 게이트 2종**:
  1. 페이지별 쿼리 수 assert (테스트 헬퍼가 RPC 호출 횟수 계측 — 예산 초과 시 실패)
  2. Lighthouse CI (모바일 Performance ≥ 90)
- Vercel Speed Insights + 서버 타이밍 로그(요청당 RTT 수·소요시간) 상시 수집 — "느려졌다"를 감이 아니라 수치로.

---

## 5. 단계별 구현 계획

각 Phase는 **완료 조건(DoD)에 성능 게이트 포함**. 기간은 1인 + AI 도구 기준.

| Phase | 내용 | 기간 | 완료 조건 (기능 + 성능 게이트) |
|---|---|---|---|
| **0. 기반** | 리포 셋업(Next 16/TS/Tailwind v4), 로컬 Supabase+시드, 디자인 토큰, next/font, CI 골격, **Vercel·Supabase 리전 확인·고정** | 3일 | CI 통과. 리전 문서화. `router.refresh`·무LIMIT 쿼리 금지 ESLint/리뷰 규칙 가동 |
| **1. 스키마+RLS** | v1 18개 마이그레이션을 정리·통합(감사로그 섀도 스토어 제거, 하드코딩 시드 제거), 실사용 RLS 정책, Custom Claims 훅, 생성 타입 | 1주 | RLS 켠 상태로 격리 테스트 통과(방 비멤버 접근 차단이 DB 레벨에서 증명) |
| **2. 인증** | Google OAuth+승인 게이트, 클레임 기반 세션, 무네트워크 미들웨어, dev 로그인 | 1주 | **인증된 요청당 DB 쿼리 0회** 계측 통과 |
| **3. 오피스+방 뼈대** | `rpc_office_view`/`rpc_room_view`, 플로어플랜, 방 셸, Suspense 스트리밍 | 1.5주 | **방 페이지 ≤3 RTT** assert. 셸 표시 <100ms(로컬) |
| **4. 채팅** | 스레드, 메시지 50개+커서, Realtime 구독, 낙관적 전송, `rpc_send_message` | 1.5주 | 폴링 타이머 0개. 전송 체감 즉시. 2-브라우저 수신 <1s (Playwright) |
| **5. AI 에이전트** | run 큐+클레임, 도구 10종, 메모리, **SSE 스트리밍**, sweep cron, 재개 워커, 개발봇 미러(cron 전용) | 2주 | 봇 첫 토큰 <3s. 어떤 사용자 요청도 Anthropic에 동기 블로킹 없음(코드 검사) |
| **6. 파일+공유/반입** | 직행 업로드, 버전, `rpc_share_files` 배치, hub-and-spoke 반입 | 1주 | 5파일×3방 공유가 **RTT ≤5** (v1: ~90) |
| **7. 결정/할일+총괄봇** | 회의방 스코프 결정/할일, 낙관적 토글, 코디네이터 브리핑(비LLM 유지) | 1주 | 저장/토글 체감 즉시 |
| **8. 화상회의** | Google Meet(OAuth 토큰 암호화 유지), Zoom 서명, 아티팩트, **AI 요약 비동기화** | 1주 | 요약 요청 즉시 202, 결과 push |
| **9. 관리자/운영** | 승인/멤버십 매트릭스, ops 대시보드(당일 집계 쿼리), 감사 로그 조회 | 1주 | ops 페이지 쿼리 수가 데이터 성장과 무관(집계만) |
| **10. 이관+검증** | v1 데이터 이관 스크립트(사용자·메시지·파일·결정·할일), E2E 전 시나리오, 부하 테스트, Lighthouse, 배포 전환 | 1주 | v1 155개 테스트 시나리오 대응분 green. Lighthouse ≥90. 성능 예산표 전 항목 실측 통과 |

**총 약 11~12주.** 압축하려면: Phase 6·7 병행, Phase 8의 Zoom을 후순위로 (v1에서도 스텁).

### 즉시 실행 항목 (v2와 무관하게 지금 v1에 적용 가치 있는 응급처치)

재구축 결정과 별개로, 아래 4개는 현재 코드에 작은 diff로 적용 가능하고 체감이 큼:
1. Vercel 함수 리전을 Supabase 리전과 일치시키기 (설정 1줄 — 잠재적 최대 효과)
2. `listMessages`에 LIMIT 50 + 인덱스 정렬 (이미 인덱스 존재)
3. 미들웨어 `getUser()`를 만료 임박 시에만 호출
4. 개발방 인라인 backfill을 cron으로 이동

---

## 6. 성능 검증 체계 (완성 후가 아니라 상시)

- **Phase마다** 성능 게이트가 DoD — "기능 다 만들고 나중에 최적화"를 구조적으로 금지.
- 쿼리 수 예산 테스트: 데이터 계층 계측 래퍼로 페이지·API별 RTT 수를 스냅샷 — 늘어나면 CI 실패.
- 합성 데이터 부하: 메시지 1만 건·run 5천 건 시드에서도 예산표 통과 (v1의 "역사가 쌓이면 느려짐" 재발 방지).
- 배포 후: Speed Insights p75 TTFB/LCP 주간 확인, 서버 로그의 요청당 RTT 수 알림.

## 7. 리스크와 완화

| 리스크 | 완화 |
|---|---|
| RLS 전환으로 권한 버그 (v1은 앱 코드 체크에 의존) | Phase 1에서 격리 테스트를 DB 레벨로 먼저 작성 (침입 시나리오 fixture) — v1의 P0 3건을 회귀 테스트로 |
| Realtime 안정성 (연결 끊김) | visibilitychange 델타 폴백 + 재구독 로직. 채팅은 커서 기반이라 놓친 메시지 복구 가능 |
| Custom Claims 훅의 멤버십 전파 지연 | 클레임에 버전 넣고 변경 시 refresh 강제. 민감 경로(관리자)는 DB 재확인 1회 허용 |
| 재구축 기간 중 v1 운영 | 5장의 "즉시 실행 항목" 4건을 v1에 선적용해 기간 중 체감 개선 |
| after() 60초 초과 run | Fluid Compute 300초 + requires_action 재개 워커(cron). 필요 시 Vercel Queues(베타) 검토 |
| 1인 개발 일정 리스크 | Phase 순서가 곧 가치 순서(인증→방→채팅→봇) — 어느 시점에 멈춰도 동작하는 제품 |

---

*근거 자료: 멀티에이전트 분석 원본은 세션 워크플로 `wf_9170277e-f6d` 산출물,
v1 이력은 docs/IMPLEMENTATION_PLAN.md · docs/CODE_REVIEW-2026-06-13.md · docs/PROJECT_REVIEW_2026-06-10.md 참조.*
