# School-X 교사연구회 AI Office — 심층 코드리뷰 (2026-06-13)

> 2026-06-10 리뷰(`docs/PROJECT_REVIEW_2026-06-10.md`) 이후의 후속 심층 리뷰. 그동안 다수 커밋으로 Phase 1/2가 반영되어 코드가 크게 바뀌었으므로, **현재 코드(main) 기준으로 독립 재검증**했다. 이전 리뷰의 P0(무인증 디버그, env mock 폴백, Zoom 서명, 토큰 평문, 단건 조회 등) 대부분은 실제로 해소되었음을 확인했다. 본 리뷰는 **새로 발견된 결함과 최근 리팩터의 회귀**에 집중한다.

---

## 0. 방법론 메모 (투명성)

- **방식**: 멀티에이전트 워크플로(`~/.claude/code-review-playbook.md`). 6개 서브시스템 병렬 매핑 → 6개 차원(보안/정확성/아키텍처/성능/UX·디자인/빌드·운영) 병렬 finder → 발견마다 적대적 검증(critical·major는 반박자+영향평가자 2표, minor·nit는 반박자 1표) → 완전성 비평.
- **규모**: 210개 에이전트 / 약 11.8M 토큰 / 2,847 tool use / 약 66분. finder/verifier는 `model: opus`.
- **검증 결과**: 검증 통과 확정 **140건** (critical 6 · major 5 · minor 77 · nit 52). *이 수치는 차원 간 중복을 포함*한다(같은 결함을 보안·정확성·아키텍처가 각각 잡음). 테마로 합치면 distinct는 약 55개. 본 보고서는 테마 단위로 병합해 정리했다.
- **오케스트레이터 결정론 교차검증 (실측)**:
  - `pnpm typecheck` → **0 오류**
  - `pnpm lint` → **0 오류**
  - `pnpm test` → **115/115 통과** (29파일, 28s) — 이전 리뷰 59건에서 약 2배 증가
  - `NEXT_PUBLIC_USE_MOCK_DATA=true pnpm build` → **성공**
  - `git ls-files | grep .env` → `.env.example`만 추적(시크릿 미커밋) ✅
  - **P0 2건은 라우트·스토어 파일을 직접 정독해 재현 경로까지 확인**(아래 P0 섹션).

---

## 1. 종합 평가

> **이전 리뷰의 운영 핫픽스는 잘 적용됐다. 그러나 "멀티테넌트 격리"라는 이 제품의 단 하나뿐인 실효 방어선에 새로운 구멍 2개가 뚫려 있다.**

이 앱의 보안 모델은 명확하다 — 모든 DB 접근이 service-role로 RLS를 우회하므로, 연구회 간 데이터 격리는 **오로지 각 라우트의 `requireUser → requireRoomMember` 검사**에만 의존한다(다층방어 0). 그런데 목록 조회 라우트 3곳에서 이 검사가 조건부로만 걸려 있거나 인가 대상과 데이터 대상이 어긋나, **인증된 아무 사용자나 한 번의 요청으로 다른 연구회의 데이터를 열람**할 수 있다. `decisions` GET은 같은 결함을 이미 한 번 고쳤지만(roomId 미지정 시 `meeting` 멤버십 요구), **형제 엔드포인트 `shared-items`·`meeting-imports`에는 그 수정이 반영되지 않았고**, 정작 `decisions`도 roomId를 *넘기는* 경로에 또 다른 인가 불일치가 남아 있다. 즉 패턴 수정이 절반만 전파된 전형적 회귀다.

| 영역 | 한 줄 평 |
|---|---|
| 보안 | 라우트 인증/인가 적용률은 높으나 **목록 엔드포인트 3곳의 인가 우회**가 격리를 정면으로 깬다(P0). 나머지는 견고 |
| 정확성 | 핫패스 단건 조회는 개선됨. 그러나 `requires_action` run 재개 부재·`after()` 좀비 run·read-modify-write 메모리 경쟁이 잔존 |
| 아키텍처 | 어댑터/레이어 규율 우수. `DataStore` 계약이 **한 방향만 강제**(supabase에 없는 mock 메서드 미보장)라 절반짜리. `database.ts` 빈 스텁 + `as unknown` 캐스팅 잔존 |
| 성능 | 폴링 채팅이 매 4초 스레드 전량 + 봇 응답마다 `router.refresh()`(getRoomView 13쿼리). `getOperationStatus`/`getRoomView`가 전역 테이블 풀스캔 |
| UX/디자인 | a11y·IME·상태 라벨은 진전. 그러나 **디자인 가이드(Navy/Gold)와 실제 토큰(paper/sage)이 전면 불일치**, Outfit 미로딩, 영문 enum·내부 테이블명 노출, 데스크톱 모델 잔재 UI |
| 빌드/운영 | CI(lint/type/test/build)는 생겼으나 e2e·마이그레이션·시크릿 스캔 게이트 부재. **Supabase Storage RLS가 형상관리 밖**, 문서 다수 부패, 관측성·보존정책 전무 |

**잘 적용된 것(유지)**: env 프로덕션 fail-fast 가드(`env.ts:79-127`), middleware 세션 갱신(공식 패턴), 원자적 run 점유(`claimAgentRunForExecution`), integration_tokens AES-256-GCM, FK 인덱스(0018), 폴링 기반 교차사용자 채팅, `HttpError`/`jsonError` 정보누출 차단, 에이전트 도구의 호출자 권한 재검증, 테스트 2배 증가.

---

## 2. P0 — 치명 (즉시 조치)

### P0-1. `shared-items` GET — roomId 미지정 시 멤버십 검사 우회로 **전체 테넌트 공유항목 열람** (격리 붕괴)

- **위치**: `src/app/api/shared-items/route.ts:22-27`, `src/server/data/supabase-store.ts:1524-1532`
- **현상**: 핸들러는 `roomId`가 **있을 때만** `requireRoomMember`를 호출한다. `roomId`를 생략하면 멤버십 검사를 통째로 건너뛰고 `source.listSharedItems(undefined)`를 호출한다. 스토어는 roomId가 falsy면 `.or()` 필터를 걸지 않아 `metadata.deletedAt`만 없는 **shared_items 전체 행**을 반환한다.
- **근거(직접 확인)**:
  ```ts
  // shared-items/route.ts:22
  const roomId = new URL(request.url).searchParams.get("roomId") ?? undefined;
  if (roomId) { await requireRoomMember(user.userId, roomId); }   // ← roomId 없으면 가드 스킵
  const source = shouldUseMockData() ? mockStore : supabaseStore;
  return jsonOk({ sharedItems: await source.listSharedItems(roomId) });
  // supabase-store.ts:1525 — roomId 없으면 무필터 SELECT
  let query = db().from("shared_items").select("*").order("created_at", { ascending: false });
  if (roomId) { query = query.or(`source_room_id.eq.${roomId},target_room_id.eq.${roomId}`); }
  ```
- **재현**: 임의의 승인 사용자로 로그인 → `GET /api/shared-items` (쿼리 없음) → 모든 연구회의 공유항목 제목·요약·source/target roomId·sharedBy 노출.
- **영향**: 멀티테넌트 핵심 불변식(방 간 격리) 정면 붕괴. service-role이 RLS를 우회하므로 이 앱 코드가 **유일한** 경계인데 그 경계가 비어 있다. 학생/교사 PII가 공유항목에 포함될 수 있어 컴플라이언스 리스크.
- **수정**: `roomId`를 필수화하거나, 미지정 시 **`tasks` GET과 동일한 패턴**(`src/app/api/tasks/route.ts:35-39`)으로 호출자의 멤버십 방 집합으로 결과를 제한. `listSharedItems(undefined)`가 전역을 반환하지 못하도록 호출부에서 보장.

### P0-2. `meeting-imports` GET — 동일 패턴으로 **전체 테넌트 반입항목 열람**

- **위치**: `src/app/api/meeting-imports/route.ts:23-28`, `src/server/data/supabase-store.ts:1579-1588`
- **현상**: P0-1과 구조 동일. `roomId` 미지정 시 `requireRoomMember`를 건너뛰고 `listImports(undefined)`가 `status!=='dismissed'`만 거른 **meeting_imports 전체**를 반환.
- **근거(직접 확인)**: `meeting-imports/route.ts:24` 조건부 `requireRoomMember` + `:28` `source.listImports(roomId)`; `supabase-store.ts:1581` roomId falsy 시 `.or()` 미적용.
- **영향**: 타 연구회의 회의방 반입 항목(요약·target/meeting roomId·importedBy·메타데이터) 전수 열람.
- **수정**: P0-1과 동일. **두 엔드포인트(+ P1-A)를 하나의 공통 헬퍼**(예: `listVisibleForUser(userId, roomId?)`)로 통일해 재발 방지.

> **공통 근본원인**: "roomId 있으면 검사, 없으면 통과 + 스토어 무필터 전역 조회"라는 안티패턴. `decisions` GET은 이미 `else { requireRoomMember(userId, "meeting") }`로 고쳤으나 형제 2곳에 전파 안 됨. **라우트 인가 회귀 테스트(roomId 누락/타방 roomId 주입)** 부재가 이 클래스를 통째로 놓치게 했다(§5 커버리지).

---

## 3. P1 — 높음 (운영 투입 전 필수)

### 보안 / 인가

| # | 발견 | 위치 | 요지 |
|---|---|---|---|
| **A** | **`decisions` GET 인가 대상↔데이터 대상 불일치** (major) | `api/decisions/route.ts:19-26` | roomId를 넘기면 *그 방* 멤버십만 검사하고(L21) 실제로는 **항상 `listDecisions("meeting")`** 반환(L26). `meeting` 비멤버가 자신이 속한 아무 방 id를 roomId로 넘겨 meeting 방 결정사항을 열람. 수정: roomId 분기 제거, 항상 `requireRoomMember(userId,"meeting")` 후 `listDecisions("meeting")` |
| B | `summarizeVideoMeeting`이 `canWriteRoom` 없이 observer도 AI 요약(비용 발생 run) 트리거 | `lib/video-meetings/service.ts:297` | observer가 임의로 비용 유발. `getAgentByRoom('development')!` 비-null 단언도 동반 |
| C | `importAnthropicSessionFiles`/`saveAgentGeneratedTextFile`에 `requireRoomMember` 부재 | `server/files/file-service.ts:328` | 권한 재검증 없이 임의 방에 파일 주입 가능(에이전트/내부 경로지만 방어선 부재) |
| D | `deleteSharedItem`/`deleteMeetingImport`가 `canWriteAnyRoom`(source **또는** target 한쪽 write만으로 삭제) | `server/collaboration/share-import-service.ts:480` | 한쪽 방 권한만으로 양방향 공유 레코드 삭제 |
| E | `executeTool` 감사로그에 도구 input **원문(평문 PII 가능)** 저장 | `server/agents/tools/execute-tool.ts:28` | audit_logs에 민감정보 무한 축적 + 마스킹/보존정책 부재와 결합 |
| F | `finalizeAgentRun`이 봇 출력 220자 단편을 무검증으로 방/스레드 요약에 영구 저장 후 **재주입** | `server/agents/finalize-agent-run.ts:17` | 프롬프트 인젝션·PII가 도메인 메모리로 승격되어 이후 모든 run에 노출 |

### 정확성 / 신뢰성

| # | 발견 | 위치 | 요지 |
|---|---|---|---|
| G | **`requires_action` run 재개 워커 부재** + `finalizeAgentRun` 무조건 호출 | `server/agents/run-agent.ts:322-323` | 도구승인 대기로 끝난 run이 좀비로 활성 슬롯 점유, 미완 출력이 "완료"처럼 요약에 반영 |
| H | `after()` fire-and-forget 실패 시 queued/running run 영구 잔존 — 복구가 **lazy sweep에만 의존** | `api/rooms/[roomId]/agent-runs/route.ts:37` | 무트래픽 시 좀비 정리 안 됨. 백그라운드 sweeper(cron) 필요 |
| I | **`DataStore` 계약이 mock→supabase 단방향만 강제** | `server/data/data-store.ts:23`, `mock-store.ts:1089` | `keyof typeof supabaseStore`로만 키를 잡아, supabase에 *없는* mock 메서드(`listVideoEvents`)는 미보장 → `getDataStore().listVideoEvents()` 프로덕션 `is not a function` 크래시 위험. 정확히 이 회귀를 막겠다던 타입이 절반짜리 |
| J | read-modify-write 메모리 경쟁(lost update) | `server/data/supabase-store.ts:1369` | `appendPendingContext`/`markPendingProcessed`/`updateMemory`가 전체 배열을 통째 덮어씀. 동시 run/반입 시 컨텍스트 유실. run 전이는 원자화했으나 메모리 경로는 비대칭 |
| K | 스키마 부재 감지가 `'schema cache'` 부분 문자열 공유 | `supabase-store.ts:107-141` | 4개 폴백이 같은 문자열 매칭 → 일시적 PostgREST 캐시 미스가 데이터를 `audit_logs`로 침묵 우회 적재하거나 legacy thread 반환 |

### 성능

| # | 발견 | 위치 | 요지 |
|---|---|---|---|
| L | **폴링 채팅 비용** — 4초마다 스레드 전량 재로드 + **봇 응답마다 `router.refresh()`**(getRoomView 13쿼리 재실행) + 화면당 폴링 루프 4개 | `components/rooms/RoomChat.tsx:61,144,48` | run 누적·메시지 누적에 비례해 폴링 1회 비용 선형 증가. `listMessages` limit/커서 부재(`supabase-store.ts:1270`) |
| M | `getOperationStatus`/`getRoomView`가 전역 테이블 풀스캔(15초·진입마다) | `office/operation-status-service.ts:15`, `rooms/get-room-view.ts:73`, `supabase-store.ts:1764` | `listAgentRuns()`/`listTasks()`/memberships/profiles를 무필터 전량 SELECT 후 JS 필터. count 집계·DB 필터로 전환 |
| N | `getRoomView`가 development 방 진입마다 **동기 backfill 미러링을 블로킹** | `rooms/get-room-view.ts:36` | 렌더 차단. `after()` 이관 또는 신규 run 시점으로 한정 |

### UX / 디자인 — 데스크톱 모델 잔재

| # | 발견 | 위치 | 요지 |
|---|---|---|---|
| O | **원본 열기 UI가 서버 로컬 경로(`~/Downloads/School-X`)를 노출** + 서버에서 `execFile`로 OS 파일 열기 | `components/meeting/SharedItemCard.tsx:96`, `server/files/file-service.ts:708` | 로컬 데스크톱 실행 모델 전제 UI가 멀티유저 웹 배포에 잔존. 일반 사용자에게 서버 파일시스템 경로 노출 + 부적절한 서버 사이드 부작용. 서버 배포에서는 숨기고 서명 URL 다운로드로 대체 |

---

## 4. P2 — 중간 (계획적 개선)

**보안/인가(잔여)**: `.or()` 필터에 사용자 roomId 무이스케이프 보간(필터 인젝션, `supabase-store.ts:1527`) · dev/coordinator 봇 read 도구가 스코프 우회로 "호출자 멤버 전체 방"으로 확장(`execute-tool.ts:216`) · `isAdmin = allowed_users.is_admin OR user_profiles.is_admin` 합집합(강등 시 권한 회수 지연, `get-current-user.ts:104`) · 쿠키 `secure`가 `NODE_ENV==='production'`에만 → 프리뷰 HTTPS에서 누락(`app-session.ts:43`) · `callback ?mock=1` 디버그 분기 프로덕션 핸들러 잔존(`auth/callback/route.ts:87`).

**정확성/품질**: 다수 라우트 Zod 검증 누락(threads 등 — 절반만 적용, `threads/route.ts:20`) · 검증 실패를 `jsonOk(4xx)`로 반환해 `jsonError` 중앙처리 우회(`files/route.ts:26`) · `get-room-view`의 `memory!` 비-null 단언(`get-room-view.ts:110`) · `updateThread` 실패 `.catch(()=>null)` 침묵 → thread 정렬 어긋남(`supabase-store.ts:1331`) · `database.ts` 빈 스텁 + `as unknown` 캐스팅으로 권한 핵심 경로 타입검증 상실(`database.ts:9`) · `isMountedSourceFile` 단일파일 false-positive(`file-service.ts:828`).

**성능(잔여)**: `getProjectObserverContext` 방별 순차 멤버십 + 전체 메시지 풀로드(`domain-memory-service.ts:65`) · coordinator briefing 방마다 7쿼리 + 호출마다 영구 INSERT(idempotency/throttle 부재, `coordinator-briefing-service.ts:66,144`) · `finalizeAgentRun`이 종료 직전 `listMessages` 2회 재조회(`finalize-agent-run.ts:14`) · MessageTimeline/MessageBubble 미메모이제이션(`MessageTimeline.tsx:79`).

**UX/디자인**: **디자인 가이드(Navy/White/Gold)와 실제 토큰(paper/sage/terracotta/bronze) 전면 불일치**(`globals.css:4`) + **Outfit 헤딩 폰트 미로딩**(`layout.tsx:17`) + 라운딩 가이드(카드 8px/버튼 9999px) vs 실제(12px/`rounded-md`) 불일치(`button.tsx:24`) — *CLAUDE.md 문서 자체가 Navy/Gold ↔ 순백/뉴트럴로 상호 모순이라 코드/문서 한쪽으로 정합화 필요* · 영문 raw enum 노출(role·accessLevel·테이블명, `MembershipManager.tsx:118`, `OpsDashboard.tsx:54`, `FileList.tsx:69`) · MeetingSidePanel 4개 버튼이 모두 동일 링크(가짜 동작) + 내부 테이블명(`shared_items`) 카피 노출(`MeetingSidePanel.tsx:32,56`) · 프로덕션 로그인에 'Mock mode' 배너 상시 노출(`(auth)/login/page.tsx:66`) · 다이얼로그 자동 포커스 부재(`FileList.tsx:169`) · `window.alert`/`window.open`/`location.reload` 직접 의존(`VideoMeetingStartDialog.tsx:63`, `VideoMeetingEndButton.tsx:29`) · placeholder/헤더 대비 WCAG 경계(`form-controls.tsx:9`, `TopHeader.tsx:14`) · 민감 동의 토글 2차 확인 부재(`VideoMeetingConsentOptions.tsx:21`) · 미사용 죽은 컴포넌트 7개(회의요약→결정/할일 전환이 빈 껍데기 = 미완 기능, `CreateDecisionTaskFromSummary.tsx`) · 다크모드 부재 · 아이콘 터치타깃 24~28px(권장 44px 미달) · 봇 토글 sr-only 키보드 포커스 미흡(`MessageComposer.tsx:324`).

**빌드/배포/운영/문서**:
- **`DEPLOYMENT.md`가 프로덕션 mock 모드 유지를 지시 → env 가드와 정면 충돌(부팅 실패 유발)**(`DEPLOYMENT.md:5`) + "RLS를 비관리 사용자로 검증" 지침이 실제 아키텍처(service-role, RLS 휴면)와 어긋남(`DEPLOYMENT.md:14`).
- 마이그레이션 `0010`에 **실명 Gmail(`devyongt@gmail.com`) admin 시드 하드코딩**(`0010:3`) — VCS 영구 박제, seed 분리 필요.
- `supabase/README.md` 마이그레이션 목록 부패(0005~0015·0017·0018 누락, `README.md:5`) · `AGENT_HANDOFF_STATUS.md`에 키 로테이션 **미이행** 명시 + 상이한 admin 이메일(`:113`) · `.env.example`↔`env.ts` 불일치(`GOOGLE_MEET_ACCESS_TOKEN` 등 누락) · `SETUP.md`가 `APP_SESSION_SECRET`/`INTEGRATION_TOKENS_ENC_KEY` 미안내 · `FINAL_QA_REPORT.md`/`SECURITY_REVIEW.md` 부패.
- CI에 e2e/마이그레이션 적용/시크릿·취약점 스캔 게이트 부재, 머지 게이트 미구분(`.github/workflows/ci.yml`) · `INTEGRATION_TOKENS_ENC_KEY`가 `assertProductionEnv` 부팅 가드에서 미검증(`env.ts:101`) · `0016_integration_tokens`가 RLS 활성화만 하고 정책 미정의(`0016:17`).
- rate limit 전무(`api.ts`) · 관측성 부재(Sentry/구조화 로깅 없이 `console.error` 9건) · 보존정책 전무 · `next.config.ts`에 maxDuration/Fluid·보안헤더·이미지 도메인 부재 · `config/model-pricing.ts` 0 USD 플레이스홀더(비용 관측 비기능) · `config/agents.ts`가 mock-data를 출처로 실제 에이전트 프로비저닝 · Zoom provider 고정 mock joinUrl 스텁(`providers/zoom.ts:16`) · 외부 jsDelivr 폰트 하드 의존(`layout.tsx:20`).

### nit (52건) — 대표

낙관적 메시지 id-only dedupe로 순간 중복(`MessageComposer.tsx:352`) · `idle` 상태 producer 부재(절반 구현 상태기계, `supabase-store.ts:1488`) · `propose_memory_update` 죽은 도구 라벨 매핑(`claude-managed-agent-adapter.ts:649`) · `audit_logs`를 가변 도메인 저장소로 전용(append-only 의미 훼손, `supabase-store.ts:992,2068`) · 낮은 뷰포트에서 방 설명 `display:none`(`globals.css:284`) 등.

---

## 5. 커버리지 갭 (완전성 비평가)

> 발견 목록은 라인 단위 결함엔 촘촘하나 **시스템 수준 안전망**이 비어 있다. 가장 비용 대비 효과 큰 두 가지: **라우트 인가 회귀 테스트**와 **Storage RLS의 마이그레이션화** — 둘 다 이미 확인된 critical 버그류의 재발을 직접 막는다.

1. **라우트/통합 테스트 0건** — `tests/` 전체에 `NextRequest`/핸들러 직접호출이 없다(확인됨). 30개 테스트는 전부 서비스/컴포넌트 단위. **P0의 격리붕괴는 정확히 이 미검증 계층에서 났다.** `requireRoomMember`/`canWriteRoom` 경계를 강제하는 계약 테스트(특히 *roomId 누락*·*타방 roomId 주입* 케이스)가 필요.
2. **Supabase Storage가 형상관리 밖** — 코드는 `workspace-files` 버킷을 하드코딩(`file-service.ts:17`)하지만, 마이그레이션 어디에도 버킷 생성·`storage.objects` RLS가 없다(`storage.objects`/`bucket_id` grep 0건). 프로비저닝이 수기 문서뿐. 버킷이 public으로 잘못 생성되면 **PII 파일이 서명URL 없이 노출**되는데 이를 막는 정책이 코드 밖이라 CI로 검증 불가. 18개 테이블은 RLS를 코드로 관리하면서 가장 민감한 바이트 저장소만 코드 밖에 둔 불일치.
3. **보존/백업/삭제(GDPR류) 정책 전무** — `pg_cron`/retention/TTL grep 0건. `room_messages`·`audit_logs`(평문 PII)·`agent_run_events`·`video_meeting_artifacts`(transcript/recording)가 무한 적재. 잊혀질 권리 대응·orphan 파일 GC·PITR 절차 부재.
4. **관측성** — correlation-id 없음, run 실패율/큐 깊이/좀비 sweep 카운터 없음. `after()` 실패가 `console.error` 한 줄로 무음 실패.
5. **마이그레이션 정합** — `0008 ADD COLUMN`이 `IF NOT EXISTS` 없이(0005·0015는 사용) 부분 적용 후 재실행 실패. CI에 빈 Postgres 적용 잡 없음. seed/스키마 분리·환경별 시드 전략 부재.
6. **mock↔supabase 행위 동등성 미검증** — conformance 테스트가 *메서드 시그니처*만 보장. `appendPendingContext`가 supabase에만, `listVideoEvents`가 mock에만 존재하는 분기를 잡지 못함.
7. **CI 게이트** — e2e(`test:e2e` 존재)·마이그레이션·`npm audit`/Dependabot/CodeQL·시크릿 스캔 부재.
8. **i18n 인프라 전무** — 한국어 문자열이 UI·서버 로그·throw에 혼재. `status-labels.ts`는 존재하나 전 화면 미적용.
9. **동시성 회귀 테스트** — read-modify-write 경쟁(J)·좀비 run(H) 재현 테스트 없음. 서버에 트랜잭션/RPC 사용 0건.
10. **비용 가드** — 토큰/비용 메트릭·테넌트별 쿼터·예산 알람 부재. 한 연구회 폭주가 전체 Anthropic 비용을 끌어올림.

---

## 6. 우선순위 로드맵

### 즉시 (반나절) — 격리 핫픽스
1. **P0-1·P0-2·P1-A** 한 번에: `shared-items`·`meeting-imports` GET를 `tasks` GET 패턴(멤버십 방으로 제한)으로 교체, `decisions` GET의 roomId 분기 제거. 공통 헬퍼로 통일.
2. 동시에 **라우트 인가 회귀 테스트** 추가: 각 목록 GET에 ① roomId 누락 ② 비멤버 roomId ③ 멤버 roomId 3케이스. 이게 P0 재발을 영구 차단.

### 1주 — 인가·신뢰성 보강
3. P1-B/C/D(요약/파일주입/삭제 권한 재검증) + P1-G/H(`requires_action` 재개 워커 + 백그라운드 좀비 sweeper).
4. P1-I: `DataStore` 계약을 양방향 강제(`satisfies` 교차) — `listVideoEvents` 등 정합 또는 제거.
5. P1-E/F + P2(executeTool input·finalize 출력): audit/메모리에 들어가는 평문 PII 마스킹·상한.

### 2~3주 — 성능·구조·문서
6. P1-L/M/N: 폴링 채팅 비용(증분 조회·`router.refresh()` 제거·count 집계), getRoomView/operation-status DB 필터화, backfill `after()` 이관.
7. P1-J/K: 메모리 갱신 원자화(RPC/낙관적 락), 스키마 폴백을 에러코드 기반으로.
8. 문서 정합화(DEPLOYMENT/README/SETUP/HANDOFF) + `.env.example`↔`env.ts` 단일 진실원 + `0010` 실명 시드 분리.
9. **Storage 버킷·`storage.objects` RLS를 마이그레이션으로 코드화** + CI 마이그레이션 적용 잡.

### 백로그 (스케일·운영 성숙)
10. 관측성(Sentry/구조화 로깅/run 메트릭), 보존정책(pg_cron), rate limit·테넌트 비용 쿼터, 디자인 토큰 정합(가이드 vs 코드 결정), 다크모드, i18n.

### 비용 대비 효과 Top 3
1. **목록 GET 3곳 인가 수정 + 회귀 테스트** — 반나절로 P0(데이터 격리 붕괴)를 막고 재발까지 봉쇄. 압도적 1순위.
2. **Storage RLS 마이그레이션화** — 가장 민감한 PII 파일 저장소를 CI 검증 가능 영역으로 끌어옴.
3. **폴링 채팅 비용 정리(router.refresh 제거 + 증분 조회)** — 누적 비용 선형 증가를 끊어 Supabase egress/DB CPU 천장 제거.

---

## 부록 A. 결정론적 검증 실측

| 검사 | 결과 |
|---|---|
| `pnpm typecheck` | ✅ 0 오류 |
| `pnpm lint` | ✅ 0 오류 |
| `pnpm test` | ✅ 115/115 (29파일) |
| `pnpm build` (mock) | ✅ 성공 (39 API 라우트 + 미들웨어) |
| `git ls-files \| grep .env` | ✅ `.env.example`만 추적 |

## 부록 B. 이전 리뷰(2026-06-10) 대비 상태

- **해소 확인**: P0-1(env mock 폴백 → 프로덕션 fail-fast 가드), P0-5(토큰 AES-256-GCM), P0-6(단건 조회 `getAgentRunById`), P0-7(`DataStore` 계약 — *단 단방향 한계 잔존, P1-I*), P1-1(`APP_SESSION_SECRET` 분리), P1-2(middleware 세션 갱신), P0-8(폴링 교차사용자 채팅 — *단 비용 이슈 P1-L*), CI 도입, FK 인덱스(0018).
- **부분/회귀**: 라우트→서비스 위임 진행 중 · Zod 절반 적용 · 디자인 정합 미결 · **목록 인가는 `decisions`만 고치고 형제 2곳 누락(P0)** · `database.ts` 스텁·`/auth/status`·실명 시드·문서 부패 잔존.
- **신규(이번 리뷰 고유)**: **P0-1/P0-2 격리붕괴**, P1-A decisions 인가 불일치, P1-I DataStore 단방향, P1-G requires_action 재개 부재, Storage RLS 형상관리 밖(커버리지 #2).

---

*본 보고서는 140건 확정 발견(차원 간 중복 포함)을 테마 단위로 병합한 것이다. critical/major는 오케스트레이터가 해당 라우트·스토어 파일을 직접 정독해 재현 경로까지 교차검증했다. 원시 발견 데이터가 필요하면 워크플로 저널(`subagents/workflows/wf_0a45c998-743/`)에서 추출 가능.*

---

## 부록 C. 적용 현황 (2026-06-13, 브랜치 `code-review-2026-06-13`)

검증 환경 한도: typecheck/lint/test로 검증 가능한 변경만 이 세션에서 적용했다. `pnpm build`는 이 머신의 Turbopack/PostCSS 서브프로세스 패닉(미적용 main에서도 동일 재현 — 환경 이슈)으로 실행 불가했고, 타입체크가 전 변경을 커버한다. 라이브 Supabase/구동 앱이 있어야 안전하게 검증되는 항목은 의도적으로 **별도 세션으로 분리**했다(이전 팀의 결정과 동일).

**적용 완료 (커밋됨, typecheck 0 · lint 0 · test 통과):**
- ✅ **P0-1/P0-2 + P1-A** — `shared-items`/`meeting-imports`/`decisions` GET 인가 격리. `getUserRoomIds` 헬퍼 + `listVisible*` 서비스 함수(route→service)로 통일. roomId 미지정 시 멤버 방으로 제한, decisions는 항상 meeting 멤버십. **회귀 테스트 9건(수정 전 실패 확인).**
- ✅ **P1-B** — `summarizeVideoMeeting` writer 게이트(observer 차단) + non-null 단언 제거. 테스트 추가.
- ✅ **P1-C** — `importAnthropicSessionFiles`/`saveAgentGeneratedTextFile`에 `requireRoomMember` 다층방어.
- ✅ **P1-G** — `requires_action`(미완) run을 finalize하지 않도록 가드(불완전 출력의 메모리 승격·재주입 차단).
- ✅ **P1-H** — `sweepStuckAgentRuns()` 전역 백스톱 + `/api/agent-runs/sweep`(CRON_SECRET 보호) + `vercel.json` 일별 cron(Hobby 플랜은 sub-daily cron 배포 거부 → 일별로 설정, 활성 방은 lazy sweep이 커버). 테스트 추가.
- ✅ **P1-I** — `DataStore` 양방향 계약 컴파일 가드(mock 전용 메서드 드리프트 차단, 드리프트 시 컴파일 실패 확인).
- ✅ **P1-E** — `executeTool` 감사로그의 도구 input을 키 목록 + 500자 미리보기로 제한(평문 PII 무한 적재 차단).
- ✅ **문서 정합화** — DEPLOYMENT(mock-mode 충돌·RLS 휴면 명시)/SETUP(APP_SESSION_SECRET·INTEGRATION_TOKENS_ENC_KEY)/supabase README(마이그레이션 전체 적용·Storage private)/HANDOFF(마이그레이션 목록)·.env.example(CRON_SECRET).

**의도적 보류 (변경 안 함 — 근거 명시):**
- **P1-D**(공유/반입 삭제 권한): source/target **둘 다** write 요구로 바꾸면 target 방 멤버의 정당한 dismiss가 막힌다. 현재 "연결된 두 방 중 한쪽 writer" 정책은 방어 가능 — 변경 안 함.
- **P1-F**(finalize 220자 요약): 에이전트 자신의 출력 발췌이며 이미 메시지로 영속화됨. PII 검출기 없이 깔끔한 마스킹 불가 — 보류.
- **requires_action 재개 워커**: 기능 추가(도구 승인 후 Anthropic 세션 재개)라 리뷰 수정 범위 밖. finalize 가드 + 스윕으로 안전한 부분만 처리.

**라이브 Supabase 세션으로 분리 (#7 쿼리 계층 + #8 마이그레이션):**
- **P1-L/M/N** — `getRoomView` 전역 멤버십/프로필 풀스캔 스코핑, `getOperationStatus` count 집계, `listMessages` keyset 페이지네이션, 폴링 증분 조회, `router.refresh()` 타겟팅. *새 SQL 정확성은 mock 테스트로 검증 불가 → 구동 Supabase 필요.* (`router.refresh()`는 봇 산출물(파일/결정/할일) 노출에 필수라 단순 제거 불가 — getRoomView를 싸게 만드는 방향이 정답.)
- **Storage `storage.objects` RLS 마이그레이션화 + `0010` 실명 시드 분리** — forward 마이그레이션 작성 후 라이브 적용·검증 필요.
- **`memory!` non-null 단언 정리** — 반환 타입을 nullable로 바꾸면 UI 전반에 가드가 번져 시각 검증 필요.

이 보류 항목들은 구동 가능한 Supabase 환경에서 별도 세션으로 진행하기를 권장한다.
