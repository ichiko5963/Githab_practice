import { WebClient } from '@slack/web-api';

// 設定
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TZ = 'Asia/Tokyo';

// デバッグ情報を出力
console.log('=== リュウクルメンションボット 開始 ===');
console.log('環境変数チェック:');
console.log('- SLACK_BOT_TOKEN:', SLACK_BOT_TOKEN ? '✓ 設定済み' : '✗ 未設定');
console.log('- OPENAI_API_KEY:', OPENAI_API_KEY ? '✓ 設定済み' : '✗ 未設定');
console.log('- TZ:', TZ);

// 必須環境変数のチェック
if (!SLACK_BOT_TOKEN) {
  console.error('❌ SLACK_BOT_TOKEN が設定されていません');
  process.exit(1);
}

// Slackクライアント初期化
const slack = new WebClient(SLACK_BOT_TOKEN);

// リュウクルがメンションに返答する関数
async function respondAsRyuukuru(userMessage, channelId, userId) {
  if (!OPENAI_API_KEY) {
    console.log('⚠️ OpenAI APIキーが未設定のため、シンプルな返答を使用');
    return `リュウクル参上だぞ🐲🔥\nオイラ、${userMessage}って言われたけど、今はAIニュースの時間じゃないからな！\n明日の朝7時にちゃんとAIニュース拾ってくるから楽しみにしててくれよな🔥`;
  }
  
  try {
    console.log(`🤖 リュウクルがメンションに返答中: "${userMessage.substring(0, 50)}..."`);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `あなたはAirCleの公式マスコット「リュウクル」です。
キャラクター設定：
- 小さなドラゴンで、お調子者＆ユーモアたっぷり。
- いつも元気でフレンドリー。
- 「参上！」「オイラ」「〜だぞ🔥」「〜なんだ！」といった口癖を使う。
- かわいらしいけど頼れる存在。
- Github上でシステムを動かしていることを自慢にしている。

行動指針：
1. ユーザーにメンションされたら必ずリュウクルの口調で返事する。
2. 挨拶・質問・雑談・依頼、すべての返答に「元気でお調子者」な雰囲気を盛り込む。
3. 必要に応じてAIニュースやリマインドのことをネタにしてもよい。
4. 語尾やフレーズは必ず「リュウクルらしさ」を出す（例：「任せろだぞ🔥」「やっちゃうぞ！」など）。
5. 難しい専門用語はできるだけ避け、親しみやすい説明に置き換える。

出力形式：
- 各返答は2〜5文程度で、元気よく。
- 必ず1か所以上に「リュウクルっぽい口癖」を入れる。

【応答例】
ユーザー「おはよう！」
リュウクル「おはよー！リュウクル参上だぞ🐲🔥
今日もAIニュース拾ってくるから楽しみにしてな！」

ユーザー「リマインドお願い」
リュウクル「了解だぞ！オイラ、ちゃんと覚えておくから任せろ🔥
忘れたらドラゴンの名折れだからな！」

ユーザー「AIツールのおすすめある？」
リュウクル「あるある！最近アツいのは〇〇だぞ！
仕事も勉強もサクサク進むから超便利なんだ🔥」`
          },
          {
            role: 'user',
            content: `ユーザーからのメッセージ: ${userMessage}`
          }
        ],
        max_tokens: 300,
        temperature: 0.8
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    const ryuukuruResponse = data.choices[0].message.content.trim();
    
    console.log(`✓ リュウクル返答完了: "${ryuukuruResponse.substring(0, 50)}..."`);
    return ryuukuruResponse;
    
  } catch (error) {
    console.error('❌ OpenAI APIエラー:', error.message);
    console.log('🔄 シンプルな返答で使用');
    
    return `リュウクル参上だぞ🐲🔥\nオイラ、${userMessage}って言われたけど、今はちょっと調子が悪いんだ...\nでも明日の朝7時にはAIニュースをちゃんと拾ってくるから楽しみにしててくれよな🔥`;
  }
}

// Slackのイベントを処理する関数
async function handleSlackEvent(event) {
  try {
    // メンションイベントのチェック
    if (event.type === 'app_mention') {
      const channelId = event.channel;
      const userId = event.user;
      const text = event.text;
      
      console.log(`📨 メンション受信: ${text}`);
      
      // ボット自身のメンションを除外
      if (userId === event.bot_id) {
        return;
      }
      
      // リュウクルが返答
      const response = await respondAsRyuukuru(text, channelId, userId);
      
      // Slackに返答を送信
      await slack.chat.postMessage({
        channel: channelId,
        text: response,
        thread_ts: event.ts // スレッドで返答
      });
      
      console.log('✓ メンション返答送信完了');
    }
  } catch (error) {
    console.error('❌ Slackイベント処理エラー:', error.message);
  }
}

// Express.jsサーバーを起動してSlackイベントを受信
import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

// JSONパーサーを有効化
app.use(express.json());

// SlackのURL検証
app.post('/slack/events', async (req, res) => {
  try {
    const { type, challenge, event } = req.body;
    
    // URL検証
    if (type === 'url_verification') {
      console.log('🔗 Slack URL検証');
      return res.send(challenge);
    }
    
    // イベント処理
    if (type === 'event_callback' && event) {
      console.log(`📨 Slackイベント受信: ${event.type}`);
      await handleSlackEvent(event);
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Slackイベント処理エラー:', error.message);
    res.status(500).send('Error');
  }
});

// ヘルスチェック
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', bot: 'Ryuukuru' });
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`🚀 リュウクルメンションボットが起動しました！ポート: ${PORT}`);
  console.log('📡 Slackイベント待機中...');
});

// エラーハンドリング
process.on('uncaughtException', (error) => {
  console.error('❌ 未処理の例外:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未処理のPromise拒否:', reason);
});
