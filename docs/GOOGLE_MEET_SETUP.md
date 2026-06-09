# Google Meet Setup

Google Meet is implemented as link creation and management. The app does not iframe the Meet UI.

Required env:

```env
GOOGLE_MEET_ENABLED=true
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
```

OAuth scopes:

- `https://www.googleapis.com/auth/meetings.space.created`
- `https://www.googleapis.com/auth/meetings.space.readonly`

Setup:

1. Set `GOOGLE_REDIRECT_URI` to the deployed callback URL, for example `https://schoolx.example.com/api/integrations/google/callback`.
2. Run all Supabase migrations, including `0016_integration_tokens.sql`.
3. Open `/admin/ops` as an admin and click `Google 연결`.
4. Grant the Meet scopes with the Google account that should create SchoolX meeting spaces.

When Google OAuth is connected, `POST /api/video-meetings` creates a Google Meet space server-side and stores the returned
`meetingUri` in `video_meetings.join_url`. Other users can immediately join through the SchoolX button.

Fallback behavior:

- If `GOOGLE_MEET_ENABLED=false`, OAuth is not connected, token refresh fails, or the Meet API call fails, SchoolX still opens `https://meet.google.com/new`.
- In fallback mode the first user can manually register the generated `https://meet.google.com/abc-defg-hij` link as before.
- For deployments that do not want DB token storage, set `GOOGLE_REFRESH_TOKEN` directly in the server environment.
