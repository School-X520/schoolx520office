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
```

3. Create a Supabase project.
4. Run SQL migrations in `supabase/migrations`.
5. Create Storage bucket `workspace-files`.
6. Add the first administrator email to `allowed_users`.
7. Configure Google OAuth in Supabase Auth.

Mock mode is enabled by `NEXT_PUBLIC_USE_MOCK_DATA=true`; the app renders without external services.
