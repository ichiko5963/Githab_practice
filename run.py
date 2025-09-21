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
    """リアクションを分析（リアクションをした人を集計）"""
    reaction_counts = Counter()
    
    for message in messages:
        if 'reactions' in message:
            for reaction in message['reactions']:
                # 各リアクションのユーザーをカウント（リアクションをした人）
                for user_id in reaction['users']:
                    reaction_counts[user_id] += 1
    
    return reaction_counts

def analyze_reactions_received(messages):
    """リアクションを受けた人を分析"""
    reaction_received_counts = Counter()
    
    for message in messages:
        if 'reactions' in message:
            # メッセージの投稿者を取得
            message_user = message.get('user')
            if message_user:
                # そのメッセージに付けられたリアクションの総数をカウント
                total_reactions = sum(reaction['count'] for reaction in message['reactions'])
                reaction_received_counts[message_user] += total_reactions
    
    return reaction_received_counts

def analyze_posts(messages):
    """投稿数を分析"""
    post_counts = Counter()
    
    for message in messages:
        # botメッセージやシステムメッセージは除外
        if message.get('subtype') in ['bot_message', 'system']:
            continue
        
        user_id = message.get('user')
        if user_id:
            post_counts[user_id] += 1
    
    return post_counts

def generate_ryuukuru_report(messages, channel_name):
    """リュウクル風のレポートを生成"""
    # 投稿数分析
    post_counts = analyze_posts(messages)
    # リアクション分析（リアクションをした人）
    reaction_given_counts = analyze_reactions(messages)
    # リアクション分析（リアクションを受けた人）
    reaction_received_counts = analyze_reactions_received(messages)
    
    # リュウクル風のレポート生成
    report = f"""リュウクル参上！
今週のSlack活動をまとめてきたぞ。

■ 集計期間: {START_JST.strftime('%Y年%m月%d日')} ～ {END_JST.strftime('%Y年%m月%d日')}
■ 実行時刻: {datetime.now().strftime('%Y年%m月%d日 %H:%M')}

今週はこんな感じだった！

1. 投稿数ランキング"""
    
    # 投稿数ランキング（上位5位）
    if post_counts:
        for i, (user_id, count) in enumerate(post_counts.most_common(5), 1):
            user_name = get_user_name(user_id)
            report += f"\n　{i}位 {user_name}さん：{count}件"
    else:
        report += "\n　投稿データなし"
    
    report += "\n\n2. リアクションを多くした人（アクティブ度）"
    
    # リアクションをした人ランキング（上位3位）
    if reaction_given_counts:
        for i, (user_id, count) in enumerate(reaction_given_counts.most_common(3), 1):
            user_name = get_user_name(user_id)
            report += f"\n　{i}位 {user_name}さん：{count}回のリアクション！"
    else:
        report += "\n　リアクションデータなし"
    
    report += "\n\n3. リアクションを多く受けた人（人気度）"
    
    # リアクションを受けた人ランキング（上位3位）
    if reaction_received_counts:
        for i, (user_id, count) in enumerate(reaction_received_counts.most_common(3), 1):
            user_name = get_user_name(user_id)
            report += f"\n　{i}位 {user_name}さん：{count}回のリアクション獲得！"
    else:
        report += "\n　リアクションデータなし"
    
    report += f"""

4. チャンネル活動状況
　{channel_name}：{len(messages)}件のメッセージ

これで今週のSlack活動は一目瞭然だな。
来週もオイラが集計して報告するから、楽しみにしててくれよ！"""
    
    return report

def main():
    try:
        # チャンネル名を取得
        channel_name = get_channel_name(CHANNELS_ID)
        
        # 期間内のメッセージを取得
        messages = get_messages_in_period(CHANNELS_ID, START_JST, END_JST)
        
        if not messages:
            print(f"指定期間内にメッセージが見つかりませんでした。")
            # エラー時でもレポートファイルを作成
            error_report = f"""リュウクル参上！
今週のSlack活動をまとめてきたぞ。

■ 集計期間: {START_JST.strftime('%Y年%m月%d日')} ～ {END_JST.strftime('%Y年%m月%d日')}
■ 実行時刻: {datetime.now().strftime('%Y年%m月%d日 %H:%M')}

申し訳ないが、今週はデータが取得できなかったぞ。
Slack Appの権限設定を確認してくれ！

来週はきっと正常に集計できるはずだ！"""
            
            with open('weekly_report.txt', 'w', encoding='utf-8') as f:
                f.write(error_report)
            return
        
        # リュウクル風レポート生成
        report = generate_ryuukuru_report(messages, channel_name)
        
        # 結果表示
        print(report)
        
        # レポートをファイルに保存（send_dm.pyで使用）
        with open('weekly_report.txt', 'w', encoding='utf-8') as f:
            f.write(report)
            
    except Exception as e:
        print(f"エラーが発生しました: {e}")
        # エラー時でもレポートファイルを作成
        error_report = f"""リュウクル参上！
今週のSlack活動をまとめてきたぞ。

■ 集計期間: {START_JST.strftime('%Y年%m月%d日')} ～ {END_JST.strftime('%Y年%m月%d日')}
■ 実行時刻: {datetime.now().strftime('%Y年%m月%d日 %H:%M')}

申し訳ないが、エラーが発生したぞ。
エラー内容: {str(e)}

Slack Appの権限設定を確認してくれ！

来週はきっと正常に集計できるはずだ！"""
        
        with open('weekly_report.txt', 'w', encoding='utf-8') as f:
            f.write(error_report)

if __name__ == "__main__":
    main()
