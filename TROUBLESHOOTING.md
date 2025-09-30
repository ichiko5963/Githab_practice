# Slack モデレーション自動化ワークフロー - トラブルシューティング

## ❌ missing_scope エラーの解決方法

### 必要なSlackアプリスコープ

`missing_scope`エラーが発生している場合、以下のスコープがSlackアプリに設定されていない可能性があります。

#### Bot Token Scopes（必須）

1. **`channels:read`** - パブリックチャンネルの情報を読み取り
2. **`channels:history`** - パブリックチャンネルの履歴を読み取り
3. **`groups:read`** - プライベートチャンネルの情報を読み取り
4. **`groups:history`** - プライベートチャンネルの履歴を読み取り
5. **`chat:write`** - メッセージを送信
6. **`users:read`** - ユーザー情報を読み取り（ボット自身のID取得用）

### スコープ設定手順

1. [Slack API](https://api.slack.com/apps)にアクセス
2. 対象のアプリを選択
3. 左側メニューの「OAuth & Permissions」をクリック
4. 「Bot Token Scopes」セクションで上記のスコープを追加
5. 「Install App to Workspace」をクリックして再インストール
6. 新しいトークンをコピーして環境変数に設定

### スコープの説明

| スコープ | 用途 |
|---|---|
| `channels:read` | パブリックチャンネルのリストと情報を取得 |
| `channels:history` | パブリックチャンネルのメッセージ履歴を取得 |
| `groups:read` | プライベートチャンネルのリストと情報を取得 |
| `groups:history` | プライベートチャンネルのメッセージ履歴を取得 |
| `chat:write` | 運営チームチャンネルに通知メッセージを送信 |
| `users:read` | ボット自身のユーザーIDを取得（メッセージフィルタリング用） |

### エラーメッセージの対処法

#### `missing_scope` エラーが発生した場合

1. **エラーログを確認**
   ```
   ❌ チャンネルリスト取得エラー: missing_scope
   💡 必要なスコープ: channels:read, groups:read
   ```

2. **該当するスコープを追加**
   - エラーメッセージに表示されたスコープをSlackアプリに追加

3. **アプリを再インストール**
   - スコープ追加後、必ず「Install App to Workspace」を実行

4. **トークンを更新**
   - 新しいトークンを`.env.local`またはGitHub Secretsに設定

### チャンネルアクセス権限の確認

ボットが対象チャンネルにアクセスできることを確認してください：

1. **パブリックチャンネル**
   - ボットをチャンネルに招待する必要はありません
   - `channels:read`と`channels:history`スコープがあればアクセス可能

2. **プライベートチャンネル**
   - ボットをチャンネルに招待する必要があります
   - `/invite @ボット名` でチャンネルに招待

### デバッグ方法

#### 1. スコープテスト
```bash
node scripts/moderation-check.js --test-check
```

#### 2. チャンネルリスト確認
```javascript
// デバッグ用コードを追加
const channelList = await slack.conversations.list({
  types: 'public_channel,private_channel'
});
console.log('利用可能なチャンネル:', channelList.channels.map(ch => ch.name));
```

#### 3. 個別チャンネルテスト
```bash
# 特定のチャンネルのみテスト
SLACK_BOT_TOKEN=your-token node -e "
const { WebClient } = require('@slack/web-api');
const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
slack.conversations.history({ channel: 'C1234567890', limit: 1 })
  .then(result => console.log('成功:', result.messages.length))
  .catch(err => console.error('エラー:', err.message));
"
```

### よくある問題と解決策

#### 問題1: チャンネルが見つからない
**原因**: チャンネル名のタイポまたはボットがチャンネルにアクセスできない
**解決策**: 
- チャンネル名を正確に確認
- プライベートチャンネルの場合はボットを招待

#### 問題2: 投稿数が0と表示されるが実際は投稿がある
**原因**: タイムゾーンの問題またはメッセージフィルタリングの問題
**解決策**:
- スクリプトのデバッグ出力を確認
- `inclusive: true`パラメータが設定されているか確認

#### 問題3: 通知が送信されない
**原因**: `chat:write`スコープがないか、運営チームチャンネルにボットが招待されていない
**解決策**:
- `chat:write`スコープを追加
- 運営チームチャンネルにボットを招待

### 最終確認チェックリスト

- [ ] `channels:read`スコープが設定されている
- [ ] `channels:history`スコープが設定されている
- [ ] `groups:read`スコープが設定されている
- [ ] `groups:history`スコープが設定されている
- [ ] `chat:write`スコープが設定されている
- [ ] `users:read`スコープが設定されている
- [ ] アプリがワークスペースに再インストールされている
- [ ] 新しいトークンが環境変数に設定されている
- [ ] プライベートチャンネルにボットが招待されている
- [ ] 運営チームチャンネルにボットが招待されている

この手順に従って設定することで、`missing_scope`エラーを解決し、正常にモデレーションチェックが動作するようになります。
