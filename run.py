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
SLACK_BOT_TOKEN = os.getenv('SLACK_BOT_TOKEN', "YOUR_SLACK_TOKEN_HERE")
# 調査対象のチャンネル（環境変数から取得、なければデフォルト値を使用）
SLACK_CHANNEL_ID = os.getenv('SLACK_CHANNEL_ID', "C09B8K9K4BV")

# 分析対象のチャンネル名（指定された7つのチャンネル）
TARGET_CHANNELS = [
    "81_chatgpt",
    "82_gemini-notebooklm", 
    "83_claude",
    "84_manus-genspark",
    "85_suno-udio-veo3-midjourney-sora",
    "86_n8n-dify-zapier",
    "87_画像生成ai"
]
# 上位いくつまでを集計するか。
RANK_NUMBER = 10

# Slackクライアントの初期化
client = WebClient(token=SLACK_BOT_TOKEN)

def get_channel_name(channel_id):
    """チャンネルIDからチャンネル名を取得"""
    try:
        response = client.conversations_info(channel=channel_id)
        return f"#{response['channel']['name']}"
    except Exception as e:
        print(f"チャンネル名取得エラー: {e}")
        return f"#{channel_id}"

def get_all_channels():
    """全てのチャンネルを取得"""
    try:
        # パブリックチャンネルを取得
        public_channels = []
        cursor = None
        while True:
            response = client.conversations_list(
                types="public_channel",
                cursor=cursor,
                limit=1000
            )
            if response['ok']:
                public_channels.extend(response['channels'])
                cursor = response.get('response_metadata', {}).get('next_cursor')
                if not cursor:
                    break
            else:
                print(f"パブリックチャンネル取得エラー: {response}")
                break
        
        # プライベートチャンネルを取得
        private_channels = []
        cursor = None
        while True:
            response = client.conversations_list(
                types="private_channel",
                cursor=cursor,
                limit=1000
            )
            if response['ok']:
                private_channels.extend(response['channels'])
                cursor = response.get('response_metadata', {}).get('next_cursor')
                if not cursor:
                    break
            else:
                print(f"プライベートチャンネル取得エラー: {response}")
                break
        
        # 全てのチャンネルを結合
        all_channels = public_channels + private_channels
        
        print(f"取得したチャンネル数: {len(all_channels)}")
        print(f"パブリックチャンネル: {len(public_channels)}")
        print(f"プライベートチャンネル: {len(private_channels)}")
        
        return all_channels
        
    except Exception as e:
        print(f"チャンネル取得エラー: {e}")
        return []

def get_target_channels():
    """指定された7つのチャンネルのみを取得"""
    try:
        all_channels = get_all_channels()
        
        # 指定された7つのチャンネルのみをフィルタリング
        target_channels = []
        for channel in all_channels:
            channel_name = channel.get('name', '')
            if channel_name in TARGET_CHANNELS:
                target_channels.append(channel)
        
        print(f"対象チャンネル数: {len(target_channels)}")
        
        # 見つかったチャンネル名を表示
        found_names = [ch.get('name', '') for ch in target_channels]
        print(f"見つかったチャンネル: {found_names}")
        
        # 見つからなかったチャンネルを表示
        missing_channels = set(TARGET_CHANNELS) - set(found_names)
        if missing_channels:
            print(f"見つからなかったチャンネル: {list(missing_channels)}")
        
        return target_channels
        
    except Exception as e:
        print(f"チャンネル取得エラー: {e}")
        return []

def is_bot_user(user_id):
    """ユーザーがbotかどうかを判定"""
    try:
        response = client.users_info(user=user_id)
        if response['ok']:
            user_info = response['user']
            return user_info.get('is_bot', False) or user_info.get('name', '').startswith('bot')
        return False
    except Exception as e:
        print(f"ユーザー情報取得エラー: {e}")
        return False

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

def get_all_messages_from_all_channels(start_time, end_time):
    """全てのチャンネルから指定期間内のメッセージを取得（個人ランキング用）"""
    all_messages = []
    all_channels = get_all_channels()
    
    print(f"全チャンネルからSlackデータを取得中...")
    print(f"期間: {start_time.strftime('%Y-%m-%d %H:%M:%S')} ～ {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"分析対象チャンネル数: {len(all_channels)}")
    
    for i, channel in enumerate(all_channels, 1):
        channel_id = channel['id']
        channel_name = channel['name']
        
        print(f"[{i}/{len(all_channels)}] チャンネル: #{channel_name}")
        
        try:
            messages = get_messages_in_period(channel_id, start_time, end_time)
            if messages:
                print(f"  → {len(messages)}件のメッセージを取得")
                all_messages.extend(messages)
            else:
                print(f"  → メッセージなし")
        except Exception as e:
            print(f"  → エラー: {e}")
            continue
        
        # API制限を避けるため少し待機
        time.sleep(0.2)
    
    print(f"総取得メッセージ数: {len(all_messages)}")
    return all_messages

def get_messages_from_target_channels(start_time, end_time):
    """指定された7つのチャンネルから指定期間内のメッセージを取得（チャンネル活動分析用）"""
    all_messages = []
    target_channels = get_target_channels()
    
    print(f"指定チャンネルからSlackデータを取得中...")
    print(f"期間: {start_time.strftime('%Y-%m-%d %H:%M:%S')} ～ {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"分析対象チャンネル数: {len(target_channels)}")
    
    for i, channel in enumerate(target_channels, 1):
        channel_id = channel['id']
        channel_name = channel['name']
        
        print(f"[{i}/{len(target_channels)}] チャンネル: #{channel_name}")
        
        try:
            messages = get_messages_in_period(channel_id, start_time, end_time)
            if messages:
                print(f"  → {len(messages)}件のメッセージを取得")
                all_messages.extend(messages)
            else:
                print(f"  → メッセージなし")
        except Exception as e:
            print(f"  → エラー: {e}")
            continue
        
        # API制限を避けるため少し待機
        time.sleep(0.2)
    
    print(f"総取得メッセージ数: {len(all_messages)}")
    return all_messages

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

def analyze_channel_activity(start_time, end_time):
    """チャンネル活動状況を分析"""
    channel_stats = {}
    target_channels = get_target_channels()
    
    for channel in target_channels:
        channel_id = channel['id']
        channel_name = channel['name']
        
        try:
            messages = get_messages_in_period(channel_id, start_time, end_time)
            
            # 投稿数（bot除外）
            post_count = 0
            reply_count = 0
            thread_count = 0
            
            for message in messages:
                # botメッセージやシステムメッセージは除外
                if message.get('subtype') in ['bot_message', 'system']:
                    continue
                
                user_id = message.get('user')
                if user_id and not is_bot_user(user_id):
                    post_count += 1
                
                # スレッド返信をカウント
                if message.get('thread_ts'):
                    thread_count += 1
                elif message.get('reply_count', 0) > 0:
                    reply_count += message.get('reply_count', 0)
            
            channel_stats[channel_name] = {
                'posts': post_count,
                'replies': reply_count,
                'threads': thread_count,
                'total_activity': post_count + reply_count + thread_count
            }
            
        except Exception as e:
            print(f"チャンネル {channel_name} の分析エラー: {e}")
            channel_stats[channel_name] = {
                'posts': 0,
                'replies': 0,
                'threads': 0,
                'total_activity': 0
            }
    
    return channel_stats

def analyze_posts(messages):
    """投稿数を分析（bot除外）"""
    post_counts = Counter()
    
    for message in messages:
        # botメッセージやシステムメッセージは除外
        if message.get('subtype') in ['bot_message', 'system']:
            continue
        
        user_id = message.get('user')
        if user_id:
            # botユーザーかどうかをチェック
            if is_bot_user(user_id):
                continue
            post_counts[user_id] += 1
    
    return post_counts

def generate_ryuukuru_report(messages, channel_stats):
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
    
    # 投稿数ランキング（上位3位）
    if post_counts:
        for i, (user_id, count) in enumerate(post_counts.most_common(3), 1):
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
    
    report += "\n\n3. リアクションを多く受けた人（有益度）"
    
    # リアクションを受けた人ランキング（上位3位）
    if reaction_received_counts:
        for i, (user_id, count) in enumerate(reaction_received_counts.most_common(3), 1):
            user_name = get_user_name(user_id)
            report += f"\n　{i}位 {user_name}さん：{count}回のリアクション獲得！"
    else:
        report += "\n　リアクションデータなし"
    
    report += "\n\n4. チャンネル活動状況ランキング"
    
    # チャンネル活動ランキング（上位3位）
    if channel_stats:
        sorted_channels = sorted(channel_stats.items(), key=lambda x: x[1]['total_activity'], reverse=True)
        for i, (channel_name, stats) in enumerate(sorted_channels[:3], 1):
            report += f"\n　{i}位 #{channel_name}：{stats['total_activity']}件（投稿:{stats['posts']}件、返信:{stats['replies']}件、スレッド:{stats['threads']}件）"
    else:
        report += "\n　チャンネル活動データなし"
    
    report += f"""

これで今週のSlack活動は一目瞭然だな。
来週もオイラが集計して報告するから、楽しみにしててくれよ！"""
    
    return report

def main():
    try:
        # 個人ランキング用：全チャンネルから期間内のメッセージを取得
        all_messages = get_all_messages_from_all_channels(START_JST, END_JST)
        
        # チャンネル活動状況を分析（指定された7つのチャンネルのみ）
        channel_stats = analyze_channel_activity(START_JST, END_JST)
        
        if not all_messages:
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
        
        # リュウクル風レポート生成（個人ランキングは全チャンネル、チャンネル活動は指定チャンネル）
        report = generate_ryuukuru_report(all_messages, channel_stats)
        
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
