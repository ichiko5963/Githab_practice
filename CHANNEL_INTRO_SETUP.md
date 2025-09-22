# Slackチャンネル紹介ボット - GitHubシークレット設定

## 必要なGitHubシークレット

このボットを動作させるために、以下のGitHubシークレットを設定する必要があります。

### 1. SLACK_BOT_TOKEN

Slackボットのトークンです。既存のボットと同じトークンを使用できます。

**設定方法:**
1. GitHubリポジトリの「Settings」タブに移動
2. 左サイドバーの「Secrets and variables」→「Actions」をクリック
3. 「New repository secret」をクリック
4. Name: `SLACK_BOT_TOKEN`
5. Secret: `xoxb-xxxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx`（実際のボットトークン）
6. 「Add secret」をクリック

### 2. TARGET_CHANNEL

メッセージを送信するチャンネル名です。

**設定方法:**
1. GitHubリポジトリの「Settings」タブに移動
2. 左サイドバーの「Secrets and variables」→「Actions」をクリック
3. 「New repository secret」をクリック
4. Name: `TARGET_CHANNEL`
5. Secret: `1-運営からの連絡`（チャンネル名、#は不要）
6. 「Add secret」をクリック

## 動作確認

### 手動実行でのテスト

1. GitHubリポジトリの「Actions」タブに移動
2. 「Slack Channel Introduction」ワークフローを選択
3. 「Run workflow」ボタンをクリック
4. 実行結果を確認

### ローカルでのテスト

```bash
# テストモードで実行（実際には送信しない）
TARGET_CHANNEL="1-運営からの連絡" node scripts/channel-intro.js --test

# 実際に送信する場合
SLACK_BOT_TOKEN="your-bot-token" TARGET_CHANNEL="1-運営からの連絡" node scripts/channel-intro.js
```

## スケジュール

- **実行時間**: 毎週月曜日 18:00 JST
- **Cron式**: `0 9 * * 1` (UTC 09:00)

## 必要なSlackスコープ

ボットに以下のスコープが必要です：

- `channels:read` - チャンネル情報の読み取り
- `groups:read` - プライベートチャンネル情報の読み取り
- `chat:write` - メッセージの送信
- `channels:write` - パブリックチャンネルへの書き込み
- `groups:write` - プライベートチャンネルへの書き込み

## トラブルシューティング

### よくあるエラー

1. **`missing_scope`エラー**
   - ボットに必要なスコープが付与されていない
   - Slackアプリの設定でスコープを追加

2. **`channel_not_found`エラー**
   - `TARGET_CHANNEL`の値が正しくない
   - チャンネル名に`#`が含まれていないか確認

3. **`not_in_channel`エラー**
   - ボットが対象チャンネルに参加していない
   - チャンネルにボットを招待

### ログの確認

GitHub Actionsの実行ログで詳細なエラー情報を確認できます。
