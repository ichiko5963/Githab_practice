#!/bin/bash

# ローカル開発用実行スクリプト
echo "🐲 リュウクルボット ローカル実行スクリプト 🔥"
echo ""

# .env.localファイルから環境変数を読み込み
if [ -f .env.local ]; then
    echo "📄 .env.localファイルを読み込み中..."
    export $(cat .env.local | grep -v '^#' | xargs)
    echo "✅ 環境変数読み込み完了"
else
    echo "❌ .env.localファイルが見つかりません"
    echo "💡 先に .env.local ファイルを編集してください"
    exit 1
fi

# トークンの確認
if [ -z "$SLACK_BOT_TOKEN" ] || [ "$SLACK_BOT_TOKEN" = "xoxb-your-slack-bot-token-here" ]; then
    echo "❌ SLACK_BOT_TOKENが設定されていません"
    echo "💡 .env.localファイルで実際のトークンを設定してください"
    exit 1
fi

if [ -z "$OPENAI_API_KEY" ] || [ "$OPENAI_API_KEY" = "sk-your-openai-api-key-here" ]; then
    echo "⚠️ OPENAI_API_KEYが設定されていません（シンプル返答モードで動作します）"
fi

echo ""
echo "🚀 リュウクルメンションボットを起動中..."
echo "📍 ポート: $PORT"
echo "🌏 ngrokの設定を忘れずに！"
echo ""

# ボット実行
npm run ryuukuru
