Slack Event 1-week Reminder Bot

This repo sends a reminder in Slack 1 week before scheduled events posted in channel `#5-イベント企画`.

It scans channel messages daily and, if a message contains a scheduled datetime, replies in the same thread when the current day is exactly 1 week prior.

Message format (assumption)
Include a datetime in messages using one of the following formats (local time, JST default):
- `開催日時: 2025-09-30 18:00`
- `日時: 2025-09-30 18:00`
- `2025-09-30 18:00`
- ISO: `2025-09-30T18:00`

Slack App Setup
1. Create a Slack app (bot) in your workspace.
2. Scopes (Bot Token):
   - `channels:read` (public channels)
   - `channels:history` (public channels history)
   - If the channel is private: `groups:read`, `groups:history`
   - `chat:write` (post messages)
3. Install the app to the workspace and add the bot to the channel `#5-イベント企画`.
4. Get the Bot User OAuth Token (starts with `xoxb-...`).
5. Get the Channel ID for `#5-イベント企画` (like `C0123456789`).

GitHub Secrets
- `SLACK_BOT_TOKEN`: Bot token from Slack (`xoxb-...`).
- `SLACK_CHANNEL_ID`: ID for `#5-イベント企画` (e.g., `C0123456789`).

How it runs
- Workflow `.github/workflows/slack-reminder.yaml` runs daily at 00:00 UTC (09:00 JST) and can be run on-demand.
- `TZ=Asia/Tokyo` is used for local-day matching.

Local run
```bash
SLACK_BOT_TOKEN=xoxb-... SLACK_CHANNEL_ID=C0123456789 TZ=Asia/Tokyo npm start
```

Notes
- Posts a reminder as a threaded reply under the original proposal message.
- Only messages with recognizable datetime formats are considered.


