# リュークル自己紹介定期報告システム

## 概要

リュークルがSlackの`#2-自己紹介`チャンネルを4日おきにチェックし、前4日間の自己紹介をまとめて報告するシステムです。

## 機能

- **定期実行**: 4日おきに午後15:00 JST（06:00 UTC）に自動実行
- **期間指定**: 実行日の前4日間のメッセージを対象
- **AI分析**: OpenAI APIを使用して自己紹介を要約・コメント生成
- **リュークルキャラ**: お調子者でユーモラスなキャラクターで報告

## ファイル構成

```
scripts/ryuukuru-selfintro.js          # メインスクリプト
.github/workflows/ryuukuru-selfintro.yml # GitHub Actions ワークフロー
```

## 必要な環境変数

### GitHub Secrets に設定が必要

1. **SLACK_BOT_TOKEN**
   - Slack Bot Token（OAuth & Permissions で取得）
   - 必要なスコープ: `chat:write`, `channels:read`, `users:read`

2. **SLACK_SELFINTRO_CHANNEL_ID**
   - 自己紹介チャンネル（例: `#2-自己紹介` または `C1234567890`）

3. **OPENAI_API_KEY**
   - OpenAI API Key（自己紹介の要約・コメント生成用）

## Slack Bot の設定

### 必要なスコープ
- `chat:write` - メッセージ送信
- `channels:read` - チャンネル情報取得
- `users:read` - ユーザー情報取得

### チャンネルへの招待
ボットを`#2-自己紹介`チャンネルに招待してください。

## 実行スケジュール

- **頻度**: 4日おき
- **時刻**: 午後15:00 JST（06:00 UTC）
- **開始日**: 2025年9月22日15:00 JST

### cron式
```
0 6 */4 * *
```

## 出力例

### 自己紹介があった場合
```
<!channel> リュウクル参上！！ 🐲🔥
この4日間（9月18日〜9月21日）の自己紹介をチェックしたぞ！

新しい仲間が自己紹介してくれたんだ！

<@U1234567890>さん：AIイラストが好きで、Geminiをよく使ってるらしいぞ。
→ 最近AIイラストは大人気だよな！オイラもGeminiで遊んでるから共感だぞ！

<@U0987654321>さん：n8nを使って作業を自動化してるらしいぞ。
→ 自動化とは頼もしい！オイラも効率化大好きだぞ！

みんなも趣味や気になることが合う子を見つけたら、スレッドで話しかけに行ってみてくれよな！

自己紹介のやり方はここにまとめてあるぞ👇
https://aircle.slack.com/docs/T09B8K99ML3/F09BDMKKYV8

オイラは定期的に自己紹介をまとめてくるから、また楽しみにしててくれよな！
```

### 自己紹介がなかった場合
```
<!channel> リュウクル参上！！ 🐲🔥
この4日間（9月18日〜9月21日）の自己紹介をチェックしたぞ！

悲しいことに、この期間は自己紹介してくれる仲間はいなかった…。
でも自己紹介すれば、趣味や興味が合う仲間とつながれるんだ。
次こそ名乗りを上げてくれよな！

自己紹介のやり方はここに載ってるぞ👇
https://aircle.slack.com/docs/T09B8K99ML3/F09BDMKKYV8

オイラは定期的に自己紹介をまとめてくるから、また楽しみにしててくれよな！
```

## 手動実行

GitHub Actions のワークフロー画面から「Run workflow」ボタンで手動実行可能です。

## トラブルシューティング

### よくあるエラー

1. **channel_not_found**
   - チャンネルIDが正しくない
   - ボットがチャンネルに参加していない

2. **missing_scope**
   - 必要なスコープが不足している
   - Bot Token を再生成してスコープを追加

3. **OpenAI API エラー**
   - API Key が無効
   - レート制限に引っかかっている

### ログ確認

GitHub Actions の実行ログで詳細なエラー情報を確認できます。

## カスタマイズ

### 実行頻度の変更
`.github/workflows/ryuukuru-selfintro.yml` の cron 式を変更：
```yaml
# 毎日実行
- cron: '0 8 * * *'
# 週1回実行（月曜日）
- cron: '0 8 * * 1'
```

### 対象期間の変更
`scripts/ryuukuru-selfintro.js` の `subDays(endDate, 4)` を変更：
```javascript
// 7日間
const startDate = subDays(endDate, 7);
```

### チャンネルの変更
環境変数 `SLACK_SELFINTRO_CHANNEL_ID` を変更するか、スクリプト内のデフォルト値を変更。

## 開発・テスト

### ローカル実行
```bash
# 環境変数を設定
export SLACK_BOT_TOKEN="your_token"
export SLACK_SELFINTRO_CHANNEL_ID="#2-自己紹介"
export OPENAI_API_KEY="your_api_key"

# スクリプト実行
node scripts/ryuukuru-selfintro.js
```

### テストモード
現在はテストモード機能は実装されていませんが、手動実行でテスト可能です。
