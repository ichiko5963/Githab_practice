# りゅうクル雑談チャンネルリマインド設定ガイド

## 概要
この機能は、Slackの「#3-雑談_質問部屋」チャンネルを毎日20:00 JSTにチェックし、その日の0:00以降に投稿が1件もなかった場合、りゅうクル口調でリマインドメッセージを自動送信します。

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

**SLACK_ZATSUDAN_CHANNEL_ID**
- Name: `SLACK_ZATSUDAN_CHANNEL_ID`
- Value: `C09XXXXXXXXX` （#3-雑談_質問部屋のチャンネルID）
- 説明: 雑談チャンネルのID

**SLACK_KEIEI_CHANNEL_ID**
- Name: `SLACK_KEIEI_CHANNEL_ID`
- Value: `C09YYYYYYYYY` （#aircle-経営部のチャンネルID）
- 説明: 経営部チャンネルのID（投稿がない場合の報告先）

### 2. チャンネルIDの取得方法

「#3-雑談_質問部屋」と「#aircle-経営部」のチャンネルIDを取得するには：

#### 方法1: Slackアプリから取得
1. Slackアプリで対象チャンネル（「#3-雑談_質問部屋」または「#aircle-経営部」）を右クリック
2. 「リンクをコピー」を選択
3. URLの末尾がチャンネルID（例：`C09XXXXXXXXX`）

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
- 毎日20:00 JST（11:00 UTC）に自動実行
- その日の0:00以降に投稿がない場合：
  1. 「#3-雑談_質問部屋」にりゅうクル口調のリマインドメッセージを送信
  2. 「#aircle-経営部」に活動レポートを送信

### 手動実行
1. GitHubリポジトリの「Actions」タブをクリック
2. 「りゅうクル雑談チャンネルリマインド」を選択
3. 「Run workflow」ボタンをクリック

### ローカルテスト
```bash
# テストモード（トークンなし）
node scripts/ryuukuru-chat-reminder.js

# 実際のSlackに送信（トークン設定済み）
SLACK_BOT_TOKEN=xoxb-... SLACK_ZATSUDAN_CHANNEL_ID=C09XXXXXXXXX SLACK_KEIEI_CHANNEL_ID=C09YYYYYYYYY node scripts/ryuukuru-chat-reminder.js
```

## 動作仕様

### チェック条件
- 実行時刻: 毎日20:00 JST
- チェック対象: その日の0:00以降の投稿
- リマインド条件: 投稿が0件の場合

### 送信メッセージ

#### 1. 雑談チャンネルへのリマインドメッセージ
りゅうクル口調で以下のようなメッセージを送信：

```
@channel

リュウクル参上！！🐲🔥

おいおい、みんな！今日はまだ何も投稿してないじゃないか！
「#3-雑談_質問部屋」はみんなの交流の場なんだぞ！

何か一言でも投稿してみろよ！
- 今日の天気の話
- お昼ご飯の話  
- ちょっとした質問
- なんでもいいから一言！

みんなの声を聞きたいんだ！リュークルが寂しがってるぞ〜😢

投稿待ってるからな！
```

#### 2. 経営部への活動レポート
以下のようなレポートメッセージを送信：

```
📊 雑談チャンネル活動レポート

本日（2025/9/30）の「#3-雑談_質問部屋」の活動状況：

❌ **投稿なし**
- 0:00以降の投稿が0件でした
- リマインドメッセージを送信済み

リュークルがみんなの投稿を待っています！🐲
```

## トラブルシューティング

### よくある問題

1. **認証エラー**
   - SLACK_BOT_TOKENが正しく設定されているか確認
   - Slack Appが適切な権限を持っているか確認

2. **チャンネルアクセスエラー**
   - SLACK_ZATSUDAN_CHANNEL_IDが正しいか確認
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
