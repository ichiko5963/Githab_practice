import os
import json
from slack_sdk.web import WebClient
from datetime import datetime, timedelta
import pytz

def send_report_to_channel():
    """
    Slack Analyticsの結果を自動化チェックチャンネルに投稿する
    """
    # 環境変数から設定を取得
    slack_token = os.getenv('SLACK_BOT_TOKEN')
    channel_id = os.getenv('SLACK_REPORT_CHANNEL_ID')
    
    if not slack_token or not channel_id:
        print("エラー: SLACK_BOT_TOKEN または SLACK_REPORT_CHANNEL_ID が設定されていません")
        return False
    
    client = WebClient(token=slack_token)
    
    try:
        # レポートファイルを読み込み
        try:
            with open('weekly_report.txt', 'r', encoding='utf-8') as f:
                report_content = f.read()
        except FileNotFoundError:
            print("エラー: weekly_report.txt が見つかりません")
            return False
        
        # チャンネルに投稿
        response = client.chat_postMessage(
            channel=channel_id,
            text=report_content
        )
        
        if response['ok']:
            print(f"チャンネル投稿成功: {channel_id}")
            return True
        else:
            print(f"チャンネル投稿失敗: {response}")
            return False
            
    except Exception as e:
        print(f"チャンネル投稿エラー: {e}")
        return False

if __name__ == "__main__":
    send_report_to_channel()
