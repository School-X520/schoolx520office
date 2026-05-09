# Deployment

## Vercel

Set all values from `.env.example` in Vercel. Keep `NEXT_PUBLIC_USE_MOCK_DATA=true` until Supabase and provider setup is complete.

## Supabase

1. Create project.
2. Configure Google OAuth redirect URLs.
3. Run migrations.
4. Create Storage bucket `workspace-files`.
5. Insert administrator email into `allowed_users`.
6. Verify RLS policies with a non-admin user.

## Anthropic

1. Add API key.
2. Confirm Managed Agents beta access.
3. Run provisioning dry-run.
4. Store returned IDs in `agents` and `room_memory_stores`.

## Video Meetings

Google Meet is link-based. Zoom embed remains disabled until security review is complete.
