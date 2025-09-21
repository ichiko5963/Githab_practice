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
            
            # 'いち' を含むユーザーを検索
            if 'いち' in real_name or 'いち' in display_name:
                found_users.append({
                    'id': user_id,
                    'real_name': real_name,
                    'display_name': display_name
                })
        
        if found_users:
            print("見つかったユーザー:")
            for user in found_users:
                print(f"  ID: {user['id']}")
                print(f"  実名: {user['real_name']}")
                print(f"  表示名: {user['display_name']}")
                print()
        else:
            print("'いち' を含むユーザーが見つかりませんでした。")
            print()
            print("全ユーザー一覧（最初の10件）:")
            for i, user in enumerate(users[:10]):
                real_name = user.get('real_name', '')
                display_name = user.get('display_name', '')
                user_id = user.get('id', '')
                print(f"  {i+1}. ID: {user_id}, 実名: {real_name}, 表示名: {display_name}")
    
    except Exception as e:
        print(f"エラーが発生しました: {e}")

if __name__ == "__main__":
    get_user_id_by_name()
