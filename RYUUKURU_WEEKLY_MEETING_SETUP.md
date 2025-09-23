# リュークル週例ミーティングリマインド設定ガイド

## 概要
リュークルキャラクターが毎週水曜と木曜の15:00に #aircle-週例mtg チャンネルに週例ミーティングのリマインドを送信します。

## ファイル構成
- `scripts/ryuukuru-weekly-meeting-reminder.js` - メインスクリプト
- `cron-schedules/ryuukuru-weekly-meeting-reminder.cron` - cron設定ファイル

## セットアップ手順

### 1. 環境変数の設定
`.env.local` ファイルにSlackボットトークンを設定してください：

```bash
SLACK_BOT_TOKEN=xoxb-your-actual-slack-bot-token-here
```

### 2. cronスケジュールの設定
以下のコマンドでcronスケジュールを設定します：

```bash
# cron設定ファイルをcrontabに追加
crontab /Users/ichiokanaoto/slack-analytics/cron-schedules/ryuukuru-weekly-meeting-reminder.cron
```

### 3. 動作確認
手動でスクリプトを実行してテストできます：

```bash
cd /Users/ichiokanaoto/slack-analytics
node scripts/ryuukuru-weekly-meeting-reminder.js
```

## スケジュール
- **水曜日 15:00** - 週例ミーティングリマインド送信
- **木曜日 15:00** - 週例ミーティングリマインド送信

## メッセージ内容
リュークルキャラクターが以下の内容でリマインドを送信します：

1. 今週の定例ミーティングの確認
2. 議事録の確認とリマインド
3. リアクションの促進

## キャラクター設定
- **名前**: リュークル
- **性格**: お調子者＆ユーモラス、でも要件はきっちり伝える
- **一人称**: オイラ
- **決まり文句**: 「リュウクル参上！！🐲🔥」で始める
- **締め**: 「リュークル応援してるぞ！」

## トラブルシューティング

### SLACK_BOT_TOKENが設定されていない場合
スクリプトはテストモードで実行され、メッセージ内容がコンソールに表示されます。

### cronが動作しない場合
1. cronサービスが起動しているか確認
2. ファイルパスが正しいか確認
3. 実行権限があるか確認

```bash
# cronサービス状態確認
sudo launchctl list | grep cron

# cronログ確認
tail -f /var/log/cron.log
```
