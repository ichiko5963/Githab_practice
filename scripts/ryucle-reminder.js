import { WebClient } from '@slack/web-api';
import express from 'express';

// 設定
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TZ = 'Asia/Tokyo';
const TASK_REMINDER_CHANNEL_ID = 'C09EMHVQFPT'; // タスクリマインドチャンネル

// デバッグ情報を出力
console.log('=== Ryucle リマインダーボット 開始 ===');
console.log('環境変数チェック:');
console.log('- SLACK_BOT_TOKEN:', SLACK_BOT_TOKEN ? '✓ 設定済み' : '✗ 未設定');
console.log('- OPENAI_API_KEY:', OPENAI_API_KEY ? '✓ 設定済み' : '✗ 未設定');
console.log('- TZ:', TZ);

// 必須環境変数のチェック
if (!SLACK_BOT_TOKEN) {
  console.error('❌ SLACK_BOT_TOKEN が設定されていません');
  process.exit(1);
}

if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY が設定されていません');
  process.exit(1);
}

// Slackクライアント初期化
const slack = new WebClient(SLACK_BOT_TOKEN);

// リマインダー情報を保存するためのメモリストレージ
const reminders = new Map();

// AIを使ってタスクと時間を解析する関数
async function extractTaskAndTimeWithAI(userMessage) {
  try {
    console.log(`🤖 AIでタスクと時間を解析中: "${userMessage.substring(0, 50)}..."`);
    
    const currentDate = new Date();
    const currentDateString = currentDate.toLocaleString('ja-JP', { timeZone: TZ });
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    const currentDay = currentDate.getDate();
    
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
            content: `あなたはタスクと時間の解析専門AIです。

ユーザーのメッセージから以下の情報を抽出してください：

1. タスク内容（何をするか）
2. 締切日・期日（具体的な日時）

出力形式（JSON）：
{
  "task": "タスク内容",
  "deadline": "YYYY-MM-DD HH:MM:SS形式の締切日時"
}

注意事項：
- 締切日が明示されていない場合は、相対的な表現（「3日後」「来週」など）から現在時刻を基準に計算
- 時刻が指定されていない場合は "23:59:59" をデフォルトとする
- 日本時間（JST）で出力
- 現在時刻は ${currentDateString} です
- 現在の年は ${currentYear}年、月は ${currentMonth}月、日は ${currentDay}日です

例：
入力: "会議の準備 来週の金曜日"
出力: {"task": "会議の準備", "deadline": "2025-09-26 23:59:59"}

入力: "資料作成 明日 15:00"
出力: {"task": "資料作成", "deadline": "2025-09-24 15:00:00"}

入力: "プロジェクト締切 10月15日"
出力: {"task": "プロジェクト締切", "deadline": "2025-10-15 23:59:59"}`
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        max_tokens: 300,
        temperature: 0.1
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    const aiResponse = data.choices[0].message.content.trim();
    
    console.log(`✓ AI解析結果: ${aiResponse}`);
    
    // JSONをパース
    const parsed = JSON.parse(aiResponse);
    
    return {
      task: parsed.task,
      deadline: new Date(parsed.deadline)
    };
    
  } catch (error) {
    console.error('❌ AI解析エラー:', error.message);
    return null;
  }
}

// リマインダーをスケジュールする関数
function scheduleReminders(reminderId, taskText, deadline, channelId, originalMessage) {
  const now = new Date();
  const targetDate = new Date(deadline);
  
  console.log(`📅 現在時刻: ${now.toLocaleString('ja-JP', { timeZone: TZ })}`);
  console.log(`📅 締切時刻: ${targetDate.toLocaleString('ja-JP', { timeZone: TZ })}`);
  
  // 3日前、1日前、12時間前のリマインダー時刻を計算
  const reminderTimes = [
    { offset: -3 * 24 * 60 * 60 * 1000, label: '3日前' },
    { offset: -1 * 24 * 60 * 60 * 1000, label: '1日前' },
    { offset: -12 * 60 * 60 * 1000, label: '12時間前' }
  ];
  
  const scheduledReminders = [];
  
  reminderTimes.forEach(({ offset, label }) => {
    const reminderTime = new Date(targetDate.getTime() + offset);
    
    console.log(`⏰ ${label}のリマインダー時刻: ${reminderTime.toLocaleString('ja-JP', { timeZone: TZ })}`);
    
    // 過去の時刻でない場合のみスケジュール
    if (reminderTime > now) {
      const timeoutDuration = reminderTime.getTime() - now.getTime();
      
      console.log(`⏰ ${label}リマインダーをスケジュール: ${Math.round(timeoutDuration / 1000 / 60)}分後`);
      
      const timeoutId = setTimeout(async () => {
        try {
          console.log(`🔔 ${label}リマインダー実行: ${taskText}`);
          
          await slack.chat.postMessage({
            channel: channelId,
            text: `リュウクル参上だぞ🐲🔥\n\n🔔 **${label}のリマインダー**\n\n${originalMessage}`,
            thread_ts: undefined // 新しいメッセージとして投稿
          });
          
          console.log(`✓ ${label}リマインダー送信完了`);
        } catch (error) {
          console.error(`❌ ${label}リマインダー送信エラー:`, error.message);
        }
      }, timeoutDuration);
      
      scheduledReminders.push(timeoutId);
    } else {
      console.log(`❌ ${label}のリマインダーは過去の時刻のためスキップ`);
    }
  });
  
  // タイムアウトIDを保存
  reminders.set(reminderId, scheduledReminders);
  
  console.log(`📅 リマインダー設定完了: ${scheduledReminders.length}個のリマインダー`);
  return scheduledReminders.length;
}

// Slackのイベントを処理する関数
async function handleSlackEvent(event) {
  try {
    console.log('📨 Slackイベントを受信:', event.type);
    
    // メッセージイベントの場合
    if (event.type === 'message') {
      // ボット自身のメッセージを除外
      if (event.bot_id) {
        return;
      }
      
      // タスクリマインドチャンネルのメッセージのみ処理
      if (event.channel === TASK_REMINDER_CHANNEL_ID) {
        console.log(`📨 タスクリマインドチャンネルでメッセージ受信: ${event.text?.substring(0, 50)}...`);
        
        // メッセージを処理
        await processTaskMessage(event);
      }
    }
  } catch (error) {
    console.error('❌ Slackイベント処理エラー:', error.message);
  }
}

// タスクメッセージを処理する関数
async function processTaskMessage(message) {
  try {
    const userId = message.user;
    const text = message.text;
    const channelId = message.channel;
    
    console.log(`📨 タスクメッセージ処理: ${text}`);
    
    // AIを使ってタスクと時間を解析
    const aiResult = await extractTaskAndTimeWithAI(text);
    
    if (!aiResult) {
      console.log('❌ AI解析に失敗しました');
      return;
    }
    
    const { task, deadline } = aiResult;
    
    // リマインダーをスケジュール
    const reminderId = `${channelId}_${userId}_${Date.now()}`;
    const scheduledCount = scheduleReminders(reminderId, task, deadline, channelId, text);
    
    if (scheduledCount > 0) {
      // 確認メッセージを送信
      await slack.chat.postMessage({
        channel: channelId,
        text: `リュウクル参上だぞ🐲🔥\n\n✅ **リマインダー設定完了！**\n\n📝 タスク: ${task}\n📅 締切: ${deadline.toLocaleString('ja-JP', { timeZone: TZ })}\n🔔 リマインダー: ${scheduledCount}個設定\n\nオイラがちゃんと覚えておくから任せろだぞ🔥`,
        thread_ts: message.ts
      });
      
      console.log('✓ リマインダー設定完了メッセージ送信');
    } else {
      // 締切が近すぎる場合
      await slack.chat.postMessage({
        channel: channelId,
        text: `リュウクル参上だぞ🐲🔥\n\n⚠️ **締切日が近すぎます！**\n\n📝 タスク: ${task}\n📅 締切: ${deadline.toLocaleString('ja-JP', { timeZone: TZ })}\n\n締切まで時間が短すぎて、リマインダーを設定できません...\nもう少し先の日付で設定し直してくれよな🔥`,
        thread_ts: message.ts
      });
      
      console.log('✓ 締切日が近すぎるメッセージ送信');
    }
    
  } catch (error) {
    console.error('❌ タスクメッセージ処理エラー:', error.message);
  }
}

// Express.jsサーバーを起動してSlackイベントを受信
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
      console.log('🔗 Slack URL検証:', challenge);
      return res.send(challenge);
    }
    
    // イベントコールバック
    if (type === 'event_callback' && event) {
      console.log('📨 Slackイベントコールバック受信');
      await handleSlackEvent(event);
      return res.status(200).send('OK');
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Slackイベント処理エラー:', error.message);
    res.status(500).send('Error');
  }
});

// ヘルスチェック
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    bot: 'Ryucle Reminder',
    timestamp: new Date().toISOString(),
    scheduledReminders: reminders.size
  });
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`🚀 Ryucleリマインダーボットが起動しました！ポート: ${PORT}`);
  console.log(`📅 現在時刻: ${new Date().toLocaleString('ja-JP', { timeZone: TZ })}`);
  console.log('📡 Slackイベント待機中...');
  console.log(`🔗 Webhook URL: http://localhost:${PORT}/slack/events`);
  console.log(`❤️ ヘルスチェック: http://localhost:${PORT}/health`);
});

// エラーハンドリング
process.on('uncaughtException', (error) => {
  console.error('❌ 未処理の例外:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未処理のPromise拒否:', reason);
});

// プロセス終了時のクリーンアップ
process.on('SIGINT', () => {
  console.log('🛑 プロセス終了中...');
  
  // 全てのタイムアウトをクリア
  reminders.forEach(timeoutIds => {
    timeoutIds.forEach(timeoutId => clearTimeout(timeoutId));
  });
  
  console.log('✅ クリーンアップ完了');
  process.exit(0);
});

// プロセス終了時のクリーンアップ（正常終了時）
process.on('exit', () => {
  console.log('🛑 プロセス終了');
});