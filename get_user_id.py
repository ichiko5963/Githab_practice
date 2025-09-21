#!/usr/bin/env python3
"""
SlackユーザーID取得ヘルパースクリプト
「いち l AI就活（代表）」のユーザーIDを取得するためのスクリプト
"""

import os
from slack_sdk.web import WebClient

def get_user_id_by_name():
    """
    ユーザー名からユーザーIDを取得する
    """
    # 環境変数からトークンを取得
    slack_token = os.getenv('SLACK_API_TOKEN')
    
    if not slack_token:
        print("エラー: SLACK_API_TOKENが設定されていません")
        print("環境変数を設定するか、以下のように実行してください：")
        print("SLACK_API_TOKEN=your_token python get_user_id.py")
        return
    
    client = WebClient(token=slack_token)
    
    try:
        # 全ユーザー情報を取得
        response = client.users_list()
        users = response['members']
        
        print("=== ユーザー一覧 ===")
        print("検索キーワード: 'いち' を含むユーザー")
        print()
        
        found_users = []
        
        for user in users:
            real_name = user.get('real_name', '')
            display_name = user.get('display_name', '')
            user_id = user.get('id', '')
            
            # 「いち」を含むユーザーを検索
            if 'いち' in real_name or 'いち' in display_name:
                found_users.append({
                    'id': user_id,
                    'real_name': real_name,
                    'display_name': display_name
                })
                print(f"✅ 見つかりました:")
                print(f"   ユーザーID: {user_id}")
                print(f"   実名: {real_name}")
                print(f"   表示名: {display_name}")
                print()
        
        if not found_users:
            print("❌ 'いち' を含むユーザーが見つかりませんでした")
            print()
            print("全ユーザー一覧:")
            for user in users[:10]:  # 最初の10人を表示
                real_name = user.get('real_name', '')
                display_name = user.get('display_name', '')
                user_id = user.get('id', '')
                print(f"  {real_name} ({display_name}): {user_id}")
            
            if len(users) > 10:
                print(f"  ... 他 {len(users) - 10} 人のユーザー")
        
        print()
        print("=== GitHub Secrets設定用 ===")
        if found_users:
            print("以下の値をGitHub Secretsの 'SLACK_DM_USER_ID' に設定してください:")
            for user in found_users:
                print(f"  {user['id']}")
        else:
            print("ユーザーが見つからない場合は、手動でユーザーIDを確認してください")
            
    except Exception as e:
        print(f"エラーが発生しました: {e}")

if __name__ == "__main__":
    get_user_id_by_name()

