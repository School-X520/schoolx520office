# Supabase Notes

Run migrations in order:

1. `0001_initial_schema.sql`
2. `0002_rls_policies.sql`
3. `0003_seed_base_data.sql`
4. `0004_video_meetings.sql`
5. `0016_integration_tokens.sql`

The service role key is used only by server-side wrappers. Browser clients rely on RLS and never receive `host_url`, service role credentials, Anthropic keys, Google secrets, or Zoom SDK secrets.
