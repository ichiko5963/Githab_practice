# GitHub Actions 自動化セットアップガイド

## 概要
このプロジェクトは、GitHub Actionsを使用して毎週月曜日の6:30（JST）にSlack Analyticsを自動実行し、結果を「いち l AI就活（代表）」のDMに送信します。

## 必要な設定

### 1. GitHub Secretsの設定

GitHubリポジトリの設定で以下のSecretsを追加してください：

#### 1.1 リポジトリのSecrets設定画面にアクセス
1. GitHubリポジトリのページに移動
2. 「Settings」タブをクリック
3. 左メニューの「Secrets and variables」→「Actions」をクリック
4. 「New repository secret」をクリック

#### 1.2 必要なSecretsを追加

以下の3つのSecretsを追加してください：

**SLACK_API_TOKEN**
- Name: `SLACK_API_TOKEN`
- Value: `YOUR_SLACK_TOKEN_HERE` （実際のトークンに置き換えてください）
- 説明: Slack AppのUser OAuth Token

**SLACK_CHANNEL_ID**
- Name: `SLACK_CHANNEL_ID`
- Value: `C09B8K9K4BV`
- 説明: 分析対象のSlackチャンネルID

**SLACK_REPORT_CHANNEL_ID**
- Name: `SLACK_REPORT_CHANNEL_ID`
- Value: `C09GRPB32QH` （自動化チェックチャンネルのID）
- 説明: レポート送信先のチャンネルID

### 2. チャンネルIDの取得方法

自動化チェックチャンネルのIDを取得するには：

#### 方法1: Slackアプリから取得
1. Slackアプリで自動化チェックチャンネルを右クリック
2. 「リンクをコピー」を選択
3. URLの末尾がチャンネルID（例：`C09GRPB32QH`）

#### 方法2: スクリプトで一覧取得
```python
from slack_sdk.web import WebClient
client = WebClient(token="YOUR_TOKEN_HERE")
channels = client.conversations_list()
for channel in channels['channels']:
    print(f"#{channel['name']}: {channel['id']}")
```

### 3. Slack Appの権限設定

Slack Appに以下の権限が必要です：

#### User Token Scopes
- `channels:history` - チャンネルのメッセージ取得
- `channels:read` - チャンネル情報取得
- `reactions:read` - リアクション情報取得
- `users:read` - ユーザー情報取得
- `chat:write` - チャンネル投稿用

## 実行方法

### 自動実行
- 毎週月曜日の6:30（JST）に自動実行
- 実行結果は自動化チェックチャンネルに投稿

### 手動実行
1. GitHubリポジトリの「Actions」タブをクリック
2. 「Slack Analytics Weekly Report」を選択
3. 「Run workflow」ボタンをクリック

## トラブルシューティング

### よくある問題

1. **認証エラー**
   - SLACK_API_TOKENが正しく設定されているか確認
   - Slack Appが適切な権限を持っているか確認

2. **チャンネルアクセスエラー**
   - SLACK_CHANNEL_IDが正しいか確認
   - Slack Appがそのチャンネルにアクセス権限を持っているか確認

3. **チャンネル投稿エラー**
   - SLACK_REPORT_CHANNEL_IDが正しいか確認
   - Slack Appがチャンネル投稿権限を持っているか確認

4. **データが取得できない**
   - 対象期間にメッセージが存在するか確認
   - Slackの制限（90日間）内であるか確認

### ログの確認方法

1. GitHub Actionsの実行ログを確認
2. 各ステップの詳細な出力を確認
3. エラーメッセージに基づいて問題を特定

## 注意事項

- フリープランのSlackワークスペースでは、過去90日間のメッセージのみアクセス可能
- APIの制限により、大量のメッセージがある場合は時間がかかる場合があります
- プライベートチャンネルにアクセスする場合は、追加の権限設定が必要です
