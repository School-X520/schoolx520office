# Final QA Report

## Scenarios

- 미승인 사용자: `/login` and `not-approved` error path documented.
- 승인 사용자: mock user can enter `/office`.
- 업무방 작업: message and mock agent API routes are implemented.
- 업무방 to 회의방: `shared_items` flow implemented in mock service.
- 회의방 @봇 호출: `meeting_guest` agent run mode is implemented at service/API level.
- 회의방 to 업무방: `meeting_imports` plus pending context implemented.
- 파일 흐름: upload/download/version service skeleton and APIs are present.
- 관리자/운영: admin and ops dashboards render mock state.
- 화상회의: create/list/end/artifact/summarize APIs and UI panel are implemented.

## Human Checks

- Supabase project and Google OAuth settings
- Anthropic key and Managed Agents beta access
- Google/Zoom app credentials
- Administrator real emails
- Student privacy and transcript/recording policy
- Cost ceilings and alert thresholds
