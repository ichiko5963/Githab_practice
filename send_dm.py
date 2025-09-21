import os
import json
from slack_sdk.web import WebClient
from datetime import datetime, timedelta
import pytz

def send_dm_to_slack():
    """
    Slack Analyticsの結果を指定されたユーザーのDMに送信する
    """
    # 環境変数から設定を取得
    slack_token = os.getenv('SLACK_API_TOKEN')
    dm_user_id = os.getenv('SLACK_DM_USER_ID')
    
    if not slack_token or not dm_user_id:
        print("エラー: SLACK_API_TOKEN または SLACK_DM_USER_ID が設定されていません")
        return False
    
    client = WebClient(token=slack_token)
    
    try:
        # 期間設定（過去1週間）
        end_jst = datetime.now()
        start_jst = end_jst - timedelta(days=7)
        
        # DM送信用のメッセージを作成
        message = f"""📊 *Slack Analytics 週次レポート*

📅 期間: {start_jst.strftime('%Y年%m月%d日')} ～ {end_jst.strftime('%Y年%m月%d日')}
⏰ 実行時刻: {datetime.now().strftime('%Y年%m月%d日 %H:%M')}

このレポートは毎週月曜日の6:30に自動実行されています。

詳細な分析結果は、GitHub Actionsのログで確認できます。
リポジトリ: https://github.com/ichiko5963/Githab_practice

🤖 GitHub Actions による自動化が正常に動作しています！"""
        
        # DMを送信
        response = client.chat_postMessage(
            channel=dm_user_id,
            text=message
        )
        
        if response['ok']:
            print(f"DM送信成功: {dm_user_id}")
            return True
        else:
            print(f"DM送信失敗: {response}")
            return False
            
    except Exception as e:
        print(f"DM送信エラー: {e}")
        return False

if __name__ == "__main__":
    send_dm_to_slack()
