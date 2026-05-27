# Claude Managed Agents Setup

이 문서는 SchoolX에 Claude Managed Agents를 연결하는 운영 순서다. 메인 회의방에는 상주 봇을 만들지 않는다. 9개 업무방에만 상주 봇을 만들고, 메인 회의방에서는 업무방 봇을 게스트로 호출한다.

## 1. Anthropic 준비

1. Anthropic Console에 로그인한다.
2. API key를 만든다.
3. Managed Agents beta 접근이 켜져 있는지 확인한다.

공식 문서 기준으로 Managed Agents는 agent, environment, session, event 개념을 사용한다. 모든 요청에는 `managed-agents-2026-04-01` beta header가 필요하다.

참고:
- https://platform.claude.com/docs/en/managed-agents/quickstart
- https://platform.claude.com/docs/en/managed-agents/agent-setup
- https://platform.claude.com/docs/en/managed-agents/environments
- https://platform.claude.com/docs/en/managed-agents/sessions
- https://platform.claude.com/docs/en/managed-agents/events-and-streaming

## 2. 로컬 환경변수

`.env.local`에 아래 값을 채운다.

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

ANTHROPIC_API_KEY=...
ANTHROPIC_BETA_HEADER=managed-agents-2026-04-01
ENABLE_REAL_AGENTS=false
```

처음에는 `ENABLE_REAL_AGENTS=false`로 둔다. provisioning이 끝난 뒤 true로 바꾼다.

선택값:

```env
ANTHROPIC_ENVIRONMENT_NAME=schoolx520office-shared-production
ANTHROPIC_ENVIRONMENT_ID=
```

`ANTHROPIC_ENVIRONMENT_ID`를 넣으면 새 environment를 만들지 않고 그 ID를 재사용한다.

## 3. Dry-run

```bash
pnpm agents:provision --dry-run
```

출력에서 아래 9개 봇이 보여야 한다.

- `finance_bot`
- `planning_bot`
- `external_bot`
- `development_bot`
- `research_bot`
- `promotion_bot`
- `city_research_bot`
- `province_research_bot`
- `science_museum_bot`

## 4. 실제 생성

```bash
pnpm agents:provision
```

스크립트가 수행하는 일:

1. Anthropic cloud environment 1개를 만든다.
2. 업무방별 Claude Managed Agent 9개를 만든다.
3. Supabase `agents` 테이블에 `anthropic_agent_id`, `anthropic_environment_id`를 저장한다.

이미 DB에 `anthropic_agent_id`가 있으면 건너뛴다. 다시 만들려면:

```bash
pnpm agents:provision --force
```

Supabase에 바로 쓰지 않고 SQL만 받고 싶으면:

```bash
pnpm agents:provision --skip-db
```

## 5. DB 확인

Supabase SQL Editor에서 확인한다.

```sql
select id, room_id, name, anthropic_agent_id, anthropic_environment_id
from public.agents
order by room_id;
```

9개 행 모두 `anthropic_agent_id`, `anthropic_environment_id`가 채워져야 한다.

## 6. 로컬 실사용 테스트

`.env.local`에서 real agent를 켠다.

```env
ENABLE_REAL_AGENTS=true
NEXT_PUBLIC_USE_MOCK_DATA=false
```

실행:

```bash
pnpm dev
```

확인:

1. 업무방 하나에 들어간다.
2. 봇 응답 토글이 켜져 있는지 확인한다.
3. 짧은 메시지를 보낸다.
4. 내 메시지가 즉시 보이고, 잠시 뒤 Claude 봇 응답이 말풍선으로 붙는지 확인한다.
5. `/admin/ops`에서 `agent_runs`, `agent_run_events`, `audit_logs`가 남는지 확인한다.

## 7. Vercel 배포 설정

Vercel Project Settings > Environment Variables에 추가한다.

```env
ANTHROPIC_API_KEY=...
ANTHROPIC_BETA_HEADER=managed-agents-2026-04-01
ENABLE_REAL_AGENTS=true
NEXT_PUBLIC_USE_MOCK_DATA=false
```

배포:

```bash
pnpm dlx vercel@latest deploy --prod --yes
```

## 8. 운영 메모

- Managed Agent session ID는 앱의 `agent_runs.anthropic_session_id`에 저장된다.
- 이벤트는 `agent_run_events`에 저장된다.
- SchoolX 앱은 Supabase DB를 직접 agent에게 열지 않는다.
- 현재 구현은 안전한 1차 연결로, Claude에게 앱 컨텍스트를 전달해 답변하게 한다.
- DB write 도구 연동은 다음 단계에서 `agent.custom_tool_use`를 받아 백엔드 wrapper로 실행하는 방식으로 확장한다.
