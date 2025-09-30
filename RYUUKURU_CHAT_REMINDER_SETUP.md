# りゅうクル担当者リマインド設定ガイド

## 概要
この機能は、毎日19:00 JSTに曜日ごとの担当者を確認し、経営部チャンネルにりゅうクル口調で担当者リマインドメッセージを自動送信します。

## 必要な設定

### 1. GitHub Secretsの設定

GitHubリポジトリの設定で以下のSecretsを追加してください：

#### 1.1 リポジトリのSecrets設定画面にアクセス
1. GitHubリポジトリのページに移動
2. 「Settings」タブをクリック
3. 左メニューの「Secrets and variables」→「Actions」をクリック
4. 「New repository secret」をクリック

#### 1.2 必要なSecretsを追加

以下の2つのSecretsを追加してください：

**SLACK_BOT_TOKEN**
- Name: `SLACK_BOT_TOKEN`
- Value: `xoxb-...` （既存のSlack Bot Token）
- 説明: Slack AppのBot User OAuth Token

**SLACK_KEIEI_CHANNEL_ID**
- Name: `SLACK_KEIEI_CHANNEL_ID`
- Value: `C09YYYYYYYYY` （#aircle-経営部のチャンネルID）
- 説明: 経営部チャンネルのID（担当者リマインド送信先）

### 2. チャンネルIDの取得方法

「#aircle-経営部」のチャンネルIDを取得するには：

#### 方法1: Slackアプリから取得
1. Slackアプリで「#aircle-経営部」チャンネルを右クリック
2. 「リンクをコピー」を選択
3. URLの末尾がチャンネルID（例：`C09YYYYYYYYY`）

#### 方法2: スクリプトで一覧取得
```javascript
import { WebClient } from '@slack/web-api';

const client = new WebClient('YOUR_TOKEN_HERE');
const channels = await client.conversations.list();
for (const channel of channels.channels) {
    console.log(`#${channel.name}: ${channel.id}`);
}
```

### 3. Slack Appの権限設定

Slack Appに以下の権限が必要です：

#### Bot Token Scopes
- `channels:read` - チャンネル情報取得
- `channels:history` - チャンネルのメッセージ取得
- `chat:write` - チャンネル投稿用

## 実行方法

### 自動実行
- 毎日19:00 JST（10:00 UTC）に自動実行
- 曜日ごとの担当者を確認し、「#aircle-経営部」にりゅうクル口調の担当者リマインドを送信

### 手動実行
1. GitHubリポジトリの「Actions」タブをクリック
2. 「りゅうクル担当者リマインド」を選択
3. 「Run workflow」ボタンをクリック

### ローカルテスト
```bash
# テストモード（トークンなし）
node scripts/ryuukuru-chat-reminder.js

# 実際のSlackに送信（トークン設定済み）
SLACK_BOT_TOKEN=xoxb-... SLACK_KEIEI_CHANNEL_ID=C09YYYYYYYYY node scripts/ryuukuru-chat-reminder.js
```

## 動作仕様

### 担当者スケジュール
- **月曜**: 大山 竜輝
- **火曜**: 市岡 直人
- **水曜**: 折井 英人
- **木曜**: 笹木 澪莉
- **金曜**: 大前 綾香
- **土曜**: 澁澤 圭佑
- **日曜**: 担当者なし（メッセージ送信なし）

### 送信メッセージ

経営部への担当者リマインドメッセージ（例：火曜日）：

```
リュウクル参上！！🐲🔥

今日は火曜だぞ！
今日の担当者は **市岡 直人** さんだ！

市岡 直人さん、今日もよろしくお願いします！
リュークルが応援してるぞ〜💪

頑張れ！頑張れ！
```

## トラブルシューティング

### よくある問題

1. **認証エラー**
   - SLACK_BOT_TOKENが正しく設定されているか確認
   - Slack Appが適切な権限を持っているか確認

2. **チャンネルアクセスエラー**
   - SLACK_KEIEI_CHANNEL_IDが正しいか確認
   - Slack Appがそのチャンネルにアクセス権限を持っているか確認

3. **メッセージ送信エラー**
   - Slack Appがチャンネル投稿権限を持っているか確認
   - ボットがチャンネルに追加されているか確認

4. **時刻のずれ**
   - タイムゾーン設定（Asia/Tokyo）が正しいか確認
   - GitHub Actionsの実行時刻が正しいか確認

### ログの確認方法

1. GitHub Actionsの実行ログを確認
2. 各ステップの詳細な出力を確認
3. エラーメッセージに基づいて問題を特定

## 注意事項

- フリープランのSlackワークスペースでは、過去90日間のメッセージのみアクセス可能
- プライベートチャンネルにアクセスする場合は、追加の権限設定が必要
- ボットがチャンネルに追加されていない場合は、メッセージ送信に失敗します
- 既存のSLACK_BOT_TOKENを使用する場合は、適切な権限が設定されていることを確認してください

## 関連ファイル

- `.github/workflows/ryuukuru-chat-reminder.yml` - GitHub Actionsワークフロー
- `scripts/ryuukuru-chat-reminder.js` - メインスクリプト
- `package.json` - 依存関係（@slack/web-api, date-fns, date-fns-tz）
