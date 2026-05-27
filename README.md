# School-X 교사연구회 AI Office

School-X 교사연구회용 AI 협업 사무실입니다. 6개 부서방, 2개 과제방, 1개 메인 회의방을 중심으로 메시지, 파일, 공유/반입, 결정사항, 할 일, mock Agent, 화상회의 결과물을 관리합니다.

## Local

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

`NEXT_PUBLIC_USE_MOCK_DATA=true`이면 외부 키 없이 `/office`와 `/rooms/meeting`이 동작합니다.

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Setup Docs

- `docs/SETUP.md`
- `docs/ANTHROPIC_SETUP.md`
- `docs/GOOGLE_MEET_SETUP.md`
- `docs/ZOOM_SETUP.md`
- `docs/DEPLOYMENT.md`
- `docs/SECURITY_REVIEW.md`
