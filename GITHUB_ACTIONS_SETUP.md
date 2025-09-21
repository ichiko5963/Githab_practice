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
- Value: `xoxp-9382655327683-9382655327699-9551605294371-7be8a9cee1c62ee56f67efb13e9b5827`
- 説明: Slack AppのUser OAuth Token

**CHANNELS_ID**
- Name: `CHANNELS_ID`
- Value: `C09B8K9K4BV`
- 説明: 分析対象のSlackチャンネルID

**SLACK_DM_USER_ID**
- Name: `SLACK_DM_USER_ID`
- Value: `U09B8K9K4BV` （「いち l AI就活（代表）」のユーザーID）
- 説明: DM送信先のユーザーID

### 2. ユーザーIDの取得方法

「いち l AI就活（代表）」のユーザーIDを取得するには：

#### 方法1: Slackアプリから取得
1. Slackアプリで「いち l AI就活（代表）」のプロフィールを表示
2. 「その他」→「メンバーIDをコピー」をクリック
3. `U`で始まるIDをコピー（例：`U09B8K9K4BV`）

#### 方法2: APIで取得
```python
from slack_sdk.web import WebClient

client = WebClient(token="YOUR_TOKEN")
users = client.users_list()
for user in users['members']:
    if "いち" in user.get('real_name', '') or "いち" in user.get('display_name', ''):
        print(f"{user['real_name']}: {user['id']}")
```

### 3. 自動化の動作確認

#### 3.1 手動実行でテスト
1. GitHubリポジトリの「Actions」タブをクリック
2. 「Slack Analytics Weekly Report」ワークフローを選択
3. 「Run workflow」ボタンをクリック
4. 実行結果を確認

#### 3.2 スケジュール実行の確認
- 毎週月曜日の6:30（JST）に自動実行されます
- 実行履歴は「Actions」タブで確認できます

## ファイル構成

```
slack-analytics/
├── .github/
│   └── workflows/
│       └── slack-analytics.yml    # GitHub Actionsワークフロー
├── run.py                         # メインの分析スクリプト
├── send_dm.py                     # DM送信スクリプト
└── README.md                      # このファイル
```

## ワークフローの詳細

### 実行スケジュール
- **cron式**: `30 21 * * 0`
- **説明**: 毎週日曜日の21:30 UTC（月曜日の6:30 JST）
- **手動実行**: ワークフローページから「Run workflow」で手動実行可能

### 実行内容
1. リポジトリのチェックアウト
2. Python環境のセットアップ
3. 依存関係のインストール
4. Slack Analyticsの実行
5. 結果のDM送信

## トラブルシューティング

### よくある問題

**1. Secretsが設定されていない**
- エラー: `SLACK_API_TOKEN または SLACK_DM_USER_ID が設定されていません`
- 解決: GitHub Secretsが正しく設定されているか確認

**2. ユーザーIDが間違っている**
- エラー: `user_not_found`
- 解決: `SLACK_DM_USER_ID`が正しいユーザーIDか確認

**3. チャンネルアクセス権限がない**
- エラー: `channel_not_found` または `not_in_channel`
- 解決: Slack Appが対象チャンネルにアクセス権限を持っているか確認

### ログの確認方法
1. GitHubリポジトリの「Actions」タブをクリック
2. 実行履歴から該当のワークフローをクリック
3. 各ステップのログを確認

## カスタマイズ

### 実行時間の変更
`.github/workflows/slack-analytics.yml`のcron式を変更：
```yaml
schedule:
  - cron: '30 21 * * 0'  # 毎週月曜日6:30 JST
  - cron: '0 22 * * 1'   # 毎週火曜日7:00 JST
  - cron: '0 0 * * 1'    # 毎週月曜日9:00 JST
```

### 送信先の変更
`SLACK_DM_USER_ID`を別のユーザーIDに変更

### 分析期間の変更
`run.py`の`DAYS_BACK`を変更（現在は7日間）

## セキュリティ注意事項

- **トークンの管理**: Slack APIトークンは機密情報です。GitHub Secrets以外に保存しないでください
- **権限の最小化**: Slack Appには必要最小限の権限のみを付与してください
- **ログの確認**: 実行ログに機密情報が含まれていないか定期的に確認してください

