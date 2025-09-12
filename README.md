Slack Automation Bot

This repo contains two automation features:

1. **Event Reminder Bot**: Sends a reminder in Slack 1 week before scheduled events posted in channel `#5-イベント企画`.
2. **AI News Bot**: Automatically collects and sends AI-related news to Slack channel `#aiニュース` every morning at 7:00 JST.

## Event Reminder Bot

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

## AI News Bot

The AI News Bot automatically collects the top 3 AI-related news from various sources and sends them to the `#aiニュース` channel every morning at 7:00 JST.

### Features
- Collects news from multiple sources (TechCrunch, The Verge, MIT Technology Review, Ars Technica, VentureBeat)
- Filters for AI-related content using intelligent keyword matching
- Sorts news by relevance and importance
- Sends beautifully formatted messages to Slack
- Runs automatically via GitHub Actions

### News Sources
- TechCrunch AI
- The Verge AI
- MIT Technology Review AI
- Ars Technica AI
- VentureBeat AI

### Slack App Setup
1. Create a Slack app (bot) in your workspace.
2. Scopes (Bot Token):
   - `channels:read` (public channels)
   - `channels:history` (public channels history)
   - If the channel is private: `groups:read`, `groups:history`
   - `chat:write` (post messages)
3. Install the app to the workspace and add the bot to both channels:
   - `#5-イベント企画` (for event reminders)
   - `#aiニュース` (for AI news)
4. Get the Bot User OAuth Token (starts with `xoxb-...`).
5. Get the Channel IDs for both channels (like `C0123456789`).

### GitHub Secrets
- `SLACK_BOT_TOKEN`: Bot token from Slack (`xoxb-...`).
- `SLACK_CHANNEL_ID`: ID for `#5-イベント企画` (e.g., `C0123456789`).
- For AI News: The bot will use the same `SLACK_CHANNEL_ID` secret, but you can override it by setting `SLACK_CHANNEL_ID` to the AI news channel ID.

### How it runs
- **Event Reminder**: Workflow `.github/workflows/slack-reminder.yaml` runs daily at 00:00 UTC (09:00 JST) and can be run on-demand.
- **AI News**: Workflow `.github/workflows/slack-news.yaml` runs daily at 22:00 UTC (07:00 JST) and can be run on-demand.
- `TZ=Asia/Tokyo` is used for local-day matching.

### Local run

Event Reminder:
```bash
SLACK_BOT_TOKEN=xoxb-... SLACK_CHANNEL_ID=C0123456789 TZ=Asia/Tokyo npm start
```

AI News:
```bash
SLACK_BOT_TOKEN=xoxb-... SLACK_CHANNEL_ID=C0123456789 TZ=Asia/Tokyo npm run ai-news
```

### Notes
- Event Reminder posts a reminder as a threaded reply under the original proposal message.
- Only messages with recognizable datetime formats are considered.
- AI News bot collects the top 3 most relevant AI news from the past 24 hours.
- Both bots use the same Slack app and token for simplicity.


