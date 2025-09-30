# SlackユーザーID取得ガイド

## 概要
リュークルX投稿確認リマインドでメンションするユーザーのIDを取得する方法を説明します。

## 方法1: 自動取得スクリプトを使用（推奨）

### 1. ユーザーID取得スクリプトを実行
```bash
# プロジェクトルートで実行
SLACK_BOT_TOKEN=your_slack_bot_token node get_user_id.js
```

### 2. 結果を確認
スクリプトが以下の情報を表示します：
- 対象ユーザー（よしき、りょうせい）のID
- 全ユーザーのリスト

### 3. リマインドスクリプトを更新
取得したIDを `scripts/ryuukuru-x-reminder.js` の `MENTION_USERS` に設定：

```javascript
const MENTION_USERS = {
  yoshiki: 'U0123456789', // 実際のよしきさんのID
  ryosei: 'U0987654321'   // 実際のりょうせいさんのID
};
```

## 方法2: Slack APIを直接使用

### 1. Slack APIトークンでユーザーリストを取得
```bash
curl -H "Authorization: Bearer YOUR_SLACK_BOT_TOKEN" \
     "https://slack.com/api/users.list"
```

### 2. レスポンスから対象ユーザーのIDを探す
```json
{
  "ok": true,
  "members": [
    {
      "id": "U0123456789",
      "name": "yoshiki",
      "profile": {
        "display_name": "よしき",
        "real_name": "よしき(運営)"
      }
    }
  ]
}
```

## 方法3: Slackアプリから確認

### 1. Slackアプリを開く
### 2. 対象ユーザーのプロフィールを表示
### 3. 「その他」→「メンバーIDをコピー」をクリック

## チャンネルIDの取得方法

### 1. Slackアプリでチャンネルを開く
### 2. チャンネル名をクリック
### 3. 「その他」→「チャンネルIDをコピー」をクリック

または、以下のURLから確認：
```
https://your-workspace.slack.com/channels/チャンネル名
```
URLの最後の部分がチャンネルIDです。

## 設定例

### GitHub Secrets の設定
```
SLACK_BOT_TOKEN: xoxb-your-bot-token
SLACK_X_REMINDER_CHANNEL_ID: C0123456789
```

### リマインドスクリプトの更新例
```javascript
const MENTION_USERS = {
  yoshiki: 'U0123456789', // @よしき(運営)
  ryosei: 'U0987654321'   // @りょうせい（運営）
};
```

## トラブルシューティング

### ユーザーが見つからない場合
1. 表示名のスペルを確認
2. ユーザーがワークスペースに存在するか確認
3. ボットがユーザー情報を取得する権限があるか確認

### メンションが機能しない場合
1. ユーザーIDが正しいか確認
2. ボットがチャンネルに参加しているか確認
3. ボットにメッセージ投稿権限があるか確認

## 注意事項
- ユーザーIDは `U` で始まる文字列です
- チャンネルIDは `C` で始まる文字列です
- ボットトークンは `xoxb-` で始まる文字列です
- これらのIDは機密情報なので、GitHub Secretsで管理してください
