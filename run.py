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
SLACK_API_TOKEN = os.getenv('SLACK_API_TOKEN', "YOUR_SLACK_TOKEN_HERE")
# 調査対象のチャンネル（環境変数から取得、なければデフォルト値を使用）
CHANNELS_ID = os.getenv('CHANNELS_ID', "C09B8K9K4BV")
# 上位いくつまでを集計するか。
RANK_NUMBER = 10

# Slackクライアントの初期化
client = WebClient(token=SLACK_API_TOKEN)

def get_channel_name(channel_id):
    """チャンネルIDからチャンネル名を取得"""
    try:
        response = client.conversations_info(channel=channel_id)
        return f"#{response['channel']['name']}"
    except Exception as e:
        print(f"チャンネル名取得エラー: {e}")
        return f"#{channel_id}"

def get_user_name(user_id):
    """ユーザーIDからユーザー名を取得"""
    try:
        response = client.users_info(user=user_id)
        return response['user']['real_name'] or response['user']['display_name'] or response['user']['name']
    except Exception as e:
        print(f"ユーザー名取得エラー: {e}")
        return user_id

def get_messages_in_period(channel_id, start_time, end_time):
    """指定期間内のメッセージを取得"""
    messages = []
    cursor = None
    
    print(f"Slackデータを取得中...")
    print(f"期間: {start_time.strftime('%Y-%m-%d %H:%M:%S')} ～ {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    while True:
        try:
            # conversations_history APIを使用
            response = client.conversations_history(
                channel=channel_id,
                oldest=str(int(start_time.timestamp())),
                latest=str(int(end_time.timestamp())),
                cursor=cursor,
                limit=1000
            )
            
            if not response['messages']:
                break
                
            messages.extend(response['messages'])
            
            # ページネーション
            if not response.get('has_more', False):
                break
            cursor = response.get('response_metadata', {}).get('next_cursor')
            
            # API制限を避けるため少し待機
            time.sleep(0.1)
            
        except Exception as e:
            print(f"メッセージ取得エラー: {e}")
            break
    
    return messages

def analyze_reactions(messages):
    """リアクションを分析"""
    reaction_counts = Counter()
    
    for message in messages:
        if 'reactions' in message:
            for reaction in message['reactions']:
                # 各リアクションのユーザーをカウント
                for user_id in reaction['users']:
                    reaction_counts[user_id] += 1
    
    return reaction_counts

def main():
    try:
        # チャンネル名を取得
        channel_name = get_channel_name(CHANNELS_ID)
        
        # 期間内のメッセージを取得
        messages = get_messages_in_period(CHANNELS_ID, START_JST, END_JST)
        
        if not messages:
            print(f"指定期間内にメッセージが見つかりませんでした。")
            return
        
        # リアクション分析
        reaction_counts = analyze_reactions(messages)
        
        # 結果表示
        print(f"\n=== 結果 ===")
        print(f"{channel_name} チャンネルの状況")
        print(f"{START_JST.strftime('%Y-%m-%d %H:%M:%S')} ～ {END_JST.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"総メッセージ数: {len(messages)}")
        
        if reaction_counts:
            print(f"リアクション回数: ")
            # 上位RANK_NUMBER件を表示
            for user_id, count in reaction_counts.most_common(RANK_NUMBER):
                user_name = get_user_name(user_id)
                print(f"  {user_name}: {count}回")
        else:
            print("リアクション: なし")
            
    except Exception as e:
        print(f"エラーが発生しました: {e}")

if __name__ == "__main__":
    main()
