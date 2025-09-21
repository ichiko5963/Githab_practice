from collections import Counter
import time
import pytz
import os
from datetime import datetime, timedelta
from slack_sdk.web import WebClient


# 期間設定オプション
DAYS_BACK = 7  # 何日前からデータを取得するか（デフォルト: 7日 = 1週間）

# 対象期間（現在から指定した日数前まで）
END_JST = datetime.now()  # 現在時刻
START_JST = END_JST - timedelta(days=DAYS_BACK)

# 代替手段: 特定期間に設定したい場合は以下を使用して上記をコメントアウト
# START_JST = datetime(2025, 9, 1, 0, 0, 0)
# END_JST = datetime(2025, 9, 22, 23, 59, 59)

# トークン（環境変数から取得、なければデフォルト値を使用）
SLACK_API_TOKEN = os.getenv('SLACK_API_TOKEN', "xoxp-9382655327683-9382655327699-9551605294371-7be8a9cee1c62ee56f67efb13e9b5827")
# 調査対象のチャンネル（環境変数から取得、なければデフォルト値を使用）
CHANNELS_ID = os.getenv('CHANNELS_ID', "C09B8K9K4BV")
# 上位いくつまでを集計するか。
RANK_NUMBER = 10

client = WebClient(token=SLACK_API_TOKEN)

def _get_conversations_info(CHANNELS_ID: str):
    all_posts_reactions = []
    message_count = 0
    # 特定の会話を、APIの上限まで取得する。
    start_utc = START_JST.astimezone(pytz.utc).timestamp()
    end_utc = END_JST.astimezone(pytz.utc).timestamp()
    
    try:
        posts = client.conversations_history(channel=CHANNELS_ID, limit=1000, oldest=start_utc, latest=end_utc)['messages']
        
        for post in posts:
            message_count = message_count + 1
            # リアクションのあったものだけを取り出す。
            if 'reactions' in post.keys():
                all_posts_reactions.append(post['reactions'])
            # 返信があるpostの場合、返信を取得（ただし、返信時にチェックを入れてチャンネルにも投稿されたpostの場合は除く）
            if 'thread_ts' in post.keys() and 'subtype' not in post.keys():
                # 簡単さと実際の利用状況の観点から、返信は100件までのカウントとする
                res = client.conversations_replies(channel=CHANNELS_ID,
                    ts=post['thread_ts'], limit=100, oldest=start_utc, latest=end_utc)
                # 0番目のメッセージは最初のpostであり集計済みなので、それ以外の返信を確認
                for reply in res['messages'][1:]:
                    # チャンネルにも投稿済みの返信は集計済みなのでスキップ
                    if 'subtype' in reply.keys():
                        continue
                    message_count = message_count + 1
                    if 'reactions' in reply.keys():
                        all_posts_reactions.append(reply['reactions'])
    except Exception as e:
        print(f"エラーが発生しました: {e}")
        return 0, []
    
    return message_count, all_posts_reactions

def _get_user_name(USER_ID: str):
    # ユーザーのIDを名前へと変換する。
    try:
        # Workspaceの全てのユーザー情報を取得する。
        USERS_LIST = client.users_list()['members']
        for row in USERS_LIST:
            if USER_ID == row['id']:
                return row['real_name'] if row['real_name'] else row['display_name']
    except Exception as e:
        print(f"ユーザー名取得エラー: {e}")
    return USER_ID

def _get_channels_name(CHANNELS_ID: str):
    # 公開チャンネルのIDを名前へと変換する。
    try:
        # Workspaceの全ての公開チャンネル情報を取得する。
        CHANNELS_LIST = client.conversations_list(limit=1000)['channels']
        for channel in CHANNELS_LIST:
            if CHANNELS_ID == channel['id']:
                return channel['name']
    except Exception as e:
        print(f"チャンネル名取得エラー: {e}")
    return CHANNELS_ID

def main():
    # トークンとチャンネルIDの設定確認
    if SLACK_API_TOKEN == "YOUR_SLACK_TOKEN_HERE":
        print("エラー: SLACK_API_TOKENを実際のトークンに置き換えてください")
        print("Slack Appの作成とトークン取得については、スクリプト内のコメントを参照してください")
        return
    
    if CHANNELS_ID == "YOUR_CHANNEL_ID_HERE":
        print("エラー: CHANNELS_IDを実際のチャンネルIDに置き換えてください")
        print("チャンネルIDの取得方法については、スクリプト内のコメントを参照してください")
        return
    
    print("Slackデータを取得中...")
    print(f"期間: {START_JST} ～ {END_JST}")
    
    # 総メッセージ数と全リアクション情報を取得
    message_count, all_posts_reactions = _get_conversations_info(CHANNELS_ID)
    
    user_list = []
    # 抽出したリアクションから、スタンプの数をカウントする。
    for post_reactions in all_posts_reactions:
        for reaction in post_reactions:
            user_list.extend(reaction['users'])
    
    # ユーザーごとのランキングを作成する。
    user_rank = Counter(user_list).most_common(RANK_NUMBER)
    
    CHANNELS_NAME = _get_channels_name(CHANNELS_ID)
    
    # 結果出力
    result = "#" + CHANNELS_NAME + " チャンネルの状況\n"
    result += f"{START_JST} ～ {END_JST}\n"
    result += f"総メッセージ数: {message_count}\n"
    result += "リアクション回数: \n"
    if user_rank:
        for user_row in user_rank:
            # IDからユーザー名に変換
            user_name = _get_user_name(user_row[0])
            # 文章を生成する。
            result += f"  {user_name}: {user_row[1]}回\n"
    else:
        result += "  リアクションはありませんでした\n"
    
    print("\n=== 結果 ===")
    print(result)

if __name__ == "__main__":
    main()

"""
=== Slack App設定手順 ===

1. Slack Appの作成
   - https://api.slack.com/apps にアクセス
   - 「Create an App」→「From scratch」を選択
   - App名と対象のワークスペースを選択

2. 必要な権限（スコープ）の設定
   「OAuth & Permissions」→「User Token Scopes」で以下を追加：
   - channels:history: 公開チャンネルのメッセージ取得
   - channels:read: 公開チャンネルの情報取得
   - emoji:read: ユーザーが追加した絵文字情報の取得
   - reactions:read: 絵文字のリアクション情報の取得
   - users:read: ユーザー情報の取得

3. アプリのインストール
   「Install App」→「Install to Workspace」→「許可」

4. トークンの取得
   インストール後に表示される「User OAuth Token」（xoxp-で始まる）をコピー
   このトークンをSLACK_API_TOKENに設定

5. チャンネルIDの取得方法
   - Slackアプリでチャンネルを右クリック→「リンクをコピー」
   - URLの末尾の文字列がチャンネルID（例：C1234567890）
   - または、以下のコードで一覧取得も可能：

   from slack_sdk.web import WebClient
   client = WebClient(token="YOUR_TOKEN")
   channels = client.conversations_list()
   for channel in channels['channels']:
       print(f"#{channel['name']}: {channel['id']}")
"""
