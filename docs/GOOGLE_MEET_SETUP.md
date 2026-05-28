# Google Meet Setup

Google Meet is implemented as link creation and management. The app does not iframe the Meet UI.

Required env:

```env
GOOGLE_MEET_ENABLED=true
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
```

Suggested scopes:

- `https://www.googleapis.com/auth/meetings.space.created`
- `https://www.googleapis.com/auth/meetings.space.readonly`

MVP behavior falls back to a Google Meet nickname link (`https://g.co/meet/{nickname}`) until OAuth/token storage is configured.
Nicknames work for users in the same Google Workspace organization; full API-created Meet spaces still require OAuth/token storage.
