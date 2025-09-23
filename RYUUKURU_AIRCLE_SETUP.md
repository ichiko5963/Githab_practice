# リュークル人材交流部リマインド設定ガイド

## 概要
リュークルキャラクターが毎週土曜と月曜の19時に #aircle-人材交流部 チャンネルで交流会の準備状況をリマインドするシステムです。

## 必要な設定

### 1. GitHub Secrets の設定

GitHub リポジトリの Settings > Secrets and variables > Actions で以下のシークレットを設定してください：

#### 必須設定
- `SLACK_BOT_TOKEN`: Slack Bot Token（既存のものを使用）
- `SLACK_AIRCLE_CHANNEL_ID`: #aircle-人材交流部 チャンネルのID

#### チャンネルIDの取得方法
1. Slackで #aircle-人材交流部 チャンネルを開く
2. チャンネル名をクリック
3. 「チャンネルの詳細」を開く
4. チャンネルIDをコピー（Cで始まる文字列）

### 2. ユーザーIDの設定

`scripts/ryuukuru-aircle-reminder.js` の以下の部分を実際のユーザーIDに変更してください：

```javascript
const MENTION_USERS = {
  miori: 'U09E5D867PX' // @みおり（運営）の実際のユーザーID（要設定）
};
```

#### ユーザーIDの取得方法
1. Slackで対象ユーザーを右クリック
2. 「プロフィールを表示」を選択
3. 「その他」メニューから「メンバーIDをコピー」

### 3. スプレッドシートの確認

現在設定されているスプレッドシートURL：
```
https://docs.google.com/spreadsheets/d/1ZP9Of73A1FXZ1-EVKdeVHzV56MN7RWrd3bsNWyL-4zE/edit?usp=sharing
```

このURLが正しいか確認し、必要に応じて変更してください。

## 実行スケジュール

- **実行日時**: 毎週土曜と月曜の19:00 JST
- **cron設定**: `0 10 * * 1,6` (UTC 10:00 = JST 19:00)
- **手動実行**: GitHub Actions のワークフロー画面から手動実行可能

## 投稿内容

リュークルキャラクターが以下の内容でリマインドします：

1. **交流会準備チェック**
   - 企画内容の詰め込み状況
   - Slack告知投稿の確認
   - 集客活動の進捗

2. **入会フォーム確認**
   - スプレッドシートのリンク表示
   - 未対応者の確認依頼
   - 1on1日程調整の指示

## テスト実行

### ローカルテスト
```bash
# 環境変数を設定
export SLACK_BOT_TOKEN="your_bot_token"
export SLACK_AIRCLE_CHANNEL_ID="your_channel_id"

# スクリプト実行
node scripts/ryuukuru-aircle-reminder.js
```

### GitHub Actions手動実行
1. GitHub リポジトリの「Actions」タブを開く
2. 「Ryuukuru Aircle Exchange Meeting Reminder」ワークフローを選択
3. 「Run workflow」ボタンをクリック

## トラブルシューティング

### よくある問題

1. **チャンネルIDが間違っている**
   - エラー: `channel_not_found`
   - 解決: 正しいチャンネルIDを設定

2. **Bot Tokenの権限不足**
   - エラー: `not_authed` または `invalid_auth`
   - 解決: Bot Tokenの権限を確認

3. **ユーザーIDが間違っている**
   - エラー: メンションが機能しない
   - 解決: 正しいユーザーIDを設定

### ログ確認

GitHub Actions の実行ログで以下を確認：
- チャンネル検証の結果
- メッセージ投稿の成功/失敗
- エラーメッセージの詳細

## カスタマイズ

### メッセージ内容の変更
`scripts/ryuukuru-aircle-reminder.js` の `generateExchangeMeetingReminderMessage()` 関数を編集

### 実行時間の変更
`.github/workflows/ryuukuru-aircle-reminder.yml` の cron 設定を変更

### 実行曜日の変更
cron の曜日部分（1,6）を変更：
- 0=日曜, 1=月曜, 2=火曜, 3=水曜, 4=木曜, 5=金曜, 6=土曜

## 注意事項

- スクリプトは土曜・月曜以外の日は実行されません
- メンション機能を使用するため、Bot Tokenに適切な権限が必要です
- スプレッドシートURLは固定で設定されています
- エラーが発生した場合は GitHub Actions のログを確認してください
