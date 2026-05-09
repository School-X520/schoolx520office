# Video Meeting QA

- Create a Google Meet meeting in `/rooms/meeting`.
- Confirm `host_url` is not returned by GET APIs.
- Confirm Zoom controls are hidden when `NEXT_PUBLIC_ENABLE_ZOOM_EMBED=false`.
- End a meeting and confirm a system message appears.
- Add manual minutes and generate AI summary.
- Convert summary items to decisions/tasks after human review.
