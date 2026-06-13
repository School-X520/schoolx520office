# Local Setup

1. Copy `.env.example` to `.env.local`.
2. Fill these values when moving out of mock mode:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
ANTHROPIC_BETA_HEADER=managed-agents-2026-04-01
APP_URL=http://localhost:3000
# 세션 쿠키 HMAC 서명용 독립 시크릿. 프로덕션 부팅 시 필수(미설정이면 throw). `openssl rand -base64 32`.
APP_SESSION_SECRET=
# OAuth refresh/access 토큰 봉투 암호화 키. `openssl rand -base64 32`.
INTEGRATION_TOKENS_ENC_KEY=
GOOGLE_MEET_ENABLED=false
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
```

3. Create a Supabase project.
4. Run SQL migrations in `supabase/migrations`.
5. Create Storage bucket `workspace-files`.
6. Add the first administrator email to `allowed_users`.

```sql
INSERT INTO public.allowed_users (email, notes, is_admin)
VALUES ('', '최초 관리자', true)
ON CONFLICT (email)
DO UPDATE SET is_active = true, is_admin = true;
```

7. Configure Google OAuth in Supabase Auth.
8. To auto-register Google Meet links, enable the Meet API in Google Cloud, set `GOOGLE_MEET_ENABLED=true`, set `GOOGLE_REDIRECT_URI` to `/api/integrations/google/callback`, then connect Google from `/admin/ops`.

Mock mode is enabled by `NEXT_PUBLIC_USE_MOCK_DATA=true`; the app renders without external services.
