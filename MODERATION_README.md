# Slack モデレーション自動化ワークフロー

このプロジェクトは、指定されたSlackチャンネルの投稿状況を監視し、投稿がない場合に運営チームに自動通知するワークフローです。

## 機能概要

- **対象チャンネル**: 7つのチャンネルを監視
- **スケジュール**: 2025年9月19日から2日おきに20:00 JSTで実行
- **通知**: 投稿がない場合、対応する運営チームチャンネルに通知

## 対象チャンネル

| 監視チャンネル | 通知先チャンネル |
|---|---|
| 81_chatgpt | chatgpt_運営チーム |
| 82_gemini-notebooklm | gemini_運営チーム |
| 83_claude | claude_運営チーム |
| 84_manus-genspark | genspark_manus_運営チーム |
| 85_suno-udio-veo3-midjourney-sora | suno_運営チーム |
| 86_n8n-dify-zapier | n8n-dify-zapier_運営チーム |
| 87_画像生成ai | veo3-midjourney-sora_運営チーム |

## スケジュール

- **開始日**: 2025年9月19日
- **実行間隔**: 2日おき（19, 21, 23, 25, 27, 29日...）
- **実行時刻**: 20:00 JST（11:00 UTC）

## セットアップ

### 1. 環境変数の設定

既存の`.env.local`ファイルを使用します。`SLACK_BOT_TOKEN`が正しく設定されていることを確認してください：

```bash
SLACK_BOT_TOKEN=xoxb-実際のトークン
```

### 2. Slackアプリの設定

Slackアプリに以下のスコープが必要です：
- `channels:history` - チャンネルの履歴を読み取り
- `chat:write` - メッセージを送信

### 3. GitHub Secretsの設定

GitHubリポジトリの「Settings」→「Secrets and variables」→「Actions」で以下を設定：
- `SLACK_BOT_TOKEN`: Slackボットトークン

## 使用方法

### スケジュールテスト

2日おきのスケジュールロジックをテストします：

```bash
node scripts/moderation-check.js --test-schedule
```

### 手動チェック実行

実際のSlack APIを使用してチェックを実行します：

```bash
node scripts/moderation-check.js --test-check
```

### 本番実行

```bash
node scripts/moderation-check.js
```

## GitHub Actions

このワークフローはGitHub Actionsで自動実行されます：

- **ファイル**: `.github/workflows/moderation-check.yml`
- **スケジュール**: 毎日20:00 JST（11:00 UTC）
- **手動実行**: ワークフローの「Run workflow」ボタンから実行可能

## ロジック詳細

1. **日付チェック**: 実行日が2日おきのスケジュールに該当するかチェック
2. **チャンネル監視**: 各対象チャンネルの当日の投稿数を確認
3. **通知判定**: 投稿数が0件の場合、対応する運営チームチャンネルに通知
4. **通知内容**: `#<チャンネル名> で今日まだ投稿がありません。ご確認ください。`

## エラーハンドリング

- チャンネルが見つからない場合、そのチャンネルはスキップ
- API制限を避けるため、チャンネル間で1秒の待機時間を設定
- エラーが発生した場合、ログに記録して処理を継続

## ログ出力例

```
=== Slackモデレーションチェックボット 開始 ===
環境変数チェック:
- SLACK_BOT_TOKEN: ✓ 設定済み
- TZ: Asia/Tokyo

🔍 モデレーションチェック開始
📅 チェック対象日: 2025-09-19
✓ 2025-09-19 はチェック対象日です

--- 81_chatgpt チェック開始 ---
📊 81_chatgpt の投稿数を確認中...
✓ 81_chatgpt: 3件の投稿を確認
✅ 81_chatgpt に 3 件の投稿があります

🎉 モデレーションチェック完了
```

## トラブルシューティング

### よくある問題

1. **SLACK_BOT_TOKEN が設定されていない**
   - `.env.local` ファイルに正しいトークンを設定してください

2. **チャンネルが見つからない**
   - チャンネル名が正確か確認してください
   - ボットがチャンネルにアクセス権限を持っているか確認してください

3. **権限エラー**
   - Slackアプリに必要なスコープが設定されているか確認してください

### デバッグ方法

詳細なログを確認するには、手動実行を使用してください：

```bash
node scripts/moderation-check.js --test-check
```

## ファイル構成

```
scripts/
├── moderation-check.js          # メインスクリプト
.github/workflows/
├── moderation-check.yml         # GitHub Actions設定
.env.local                       # 環境変数（既存）
```

## ライセンス

このプロジェクトは MIT ライセンスの下で公開されています。
