# Slack Analytics - 動的期間設定対応

このスクリプトは、指定したSlackチャンネルの投稿数とリアクション状況を取得します。
デフォルトでは現在から2週間前までのデータを取得しますが、期間は自由に設定可能です。

## セットアップ手順

### 1. Slack Appの作成と設定

#### 1.1 Slack Appの作成
1. [https://api.slack.com/apps](https://api.slack.com/apps) にアクセス
2. 「Create an App」ボタンをクリック
3. 「From scratch」を選択
4. App名を入力（例：「Analytics App」）
5. 対象のワークスペースを選択
6. 「Create App」をクリック

#### 1.2 必要な権限（スコープ）の設定
1. 左メニューの「OAuth & Permissions」をクリック
2. 「Scopes」セクションの「User Token Scopes」で以下を追加：
   - `channels:history` - 公開チャンネルのメッセージ取得
   - `channels:read` - 公開チャンネルの情報取得  
   - `emoji:read` - ユーザーが追加した絵文字情報の取得
   - `reactions:read` - 絵文字のリアクション情報の取得
   - `users:read` - ユーザー情報の取得

#### 1.3 アプリのインストール
1. 左メニューの「Install App」をクリック
2. 「Install to Workspace」ボタンをクリック
3. 権限確認画面で「許可」をクリック

#### 1.4 トークンの取得
- インストール後に表示される「User OAuth Token」（`xoxp-`で始まる文字列）をコピー
- このトークンを`run.py`の`SLACK_API_TOKEN`に設定

### 2. チャンネルIDの取得方法

#### 方法1: Slackアプリから取得
1. Slackアプリで対象チャンネルを右クリック
2. 「リンクをコピー」を選択
3. URLの末尾がチャンネルID（例：`C1234567890`）

#### 方法2: スクリプトで一覧取得
```python
from slack_sdk.web import WebClient
client = WebClient(token="YOUR_TOKEN_HERE")
channels = client.conversations_list()
for channel in channels['channels']:
    print(f"#{channel['name']}: {channel['id']}")
```

### 3. 期間設定

スクリプトはデフォルトで現在から2週間前までのデータを取得します。

#### 方法1: 取得日数を変更
`run.py`の`DAYS_BACK`を変更してください：
```python
DAYS_BACK = 14  # 2週間
DAYS_BACK = 7   # 1週間
DAYS_BACK = 30  # 1ヶ月
DAYS_BACK = 90  # 3ヶ月
```

#### 方法2: 特定期間を指定
特定の期間を指定したい場合、動的設定をコメントアウトして固定期間を有効にしてください：
```python
# 動的設定をコメントアウト
# END_JST = datetime.now()
# START_JST = END_JST - timedelta(days=DAYS_BACK)

# 特定期間を有効に
START_JST = datetime(2025, 9, 1, 0, 0, 0)
END_JST = datetime(2025, 9, 22, 23, 59, 59)
```

### 4. スクリプトの実行

1. `run.py`を編集：
   - `SLACK_API_TOKEN`に取得したトークンを設定
   - `CHANNELS_ID`に対象チャンネルのIDを設定
   - 必要に応じて`DAYS_BACK`を調整

2. 仮想環境をアクティベートして実行：
```bash
source bin/activate
python run.py
```

## 出力例

```
Slackデータを取得中...
期間: 2025-09-08 06:03:34 ～ 2025-09-22 06:03:34

=== 結果 ===
#general チャンネルの状況
2025-09-08 06:03:34 ～ 2025-09-22 06:03:34
総メッセージ数: 25
リアクション回数: 
  田中太郎: 8回
  佐藤花子: 5回
  山田次郎: 3回
```

実行時の時刻によって表示される期間は変わります。デフォルトでは実行時から2週間前までのデータを取得します。

## 注意事項

- フリープランのSlackワークスペースでは、過去90日間のメッセージのみアクセス可能
- APIの制限により、大量のメッセージがある場合は時間がかかる場合があります
- プライベートチャンネルにアクセスする場合は、追加の権限設定が必要です

## トラブルシューティング

- **認証エラー**: トークンが正しく設定されているか確認
- **チャンネルアクセスエラー**: チャンネルIDが正しいか、Appがそのチャンネルにアクセス権限を持っているか確認
- **データが取得できない**: 対象期間にメッセージが存在するか、Slack の制限（90日間）内であるか確認
