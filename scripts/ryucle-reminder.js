import { WebClient } from '@slack/web-api';
import express from 'express';

// 設定
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TZ = 'Asia/Tokyo';

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

// リマインダー情報を保存するためのメモリストレージ（本番環境ではデータベースを使用推奨）
const reminders = new Map();
const pendingConfirmations = new Map(); // 確認待ちのリマインダー
const processedMessages = new Set(); // 処理済みメッセージのIDを保存

// 処理済みメッセージをファイルに保存する関数
function saveProcessedMessages() {
  const fs = require('fs');
  const data = {
    messages: Array.from(processedMessages),
    timestamp: new Date().toISOString()
  };
  try {
    fs.writeFileSync('/tmp/processed_messages.json', JSON.stringify(data));
  } catch (error) {
    console.error('❌ 処理済みメッセージの保存エラー:', error.message);
  }
}

// 処理済みメッセージをファイルから読み込む関数
function loadProcessedMessages() {
  const fs = require('fs');
  try {
    const data = fs.readFileSync('/tmp/processed_messages.json', 'utf8');
    const parsed = JSON.parse(data);
    processedMessages.clear();
    parsed.messages.forEach(id => processedMessages.add(id));
    console.log(`📚 処理済みメッセージを読み込み: ${processedMessages.size}件`);
  } catch (error) {
    console.log('📚 処理済みメッセージファイルが見つかりません（初回実行）');
  }
}

// AIを使って締切日を抽出する関数
async function extractDeadlineWithAI(userMessage) {
  try {
    console.log(`🤖 AIで締切日を解析中: "${userMessage.substring(0, 50)}..."`);
    
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
            content: `あなたは日付・時刻の解析専門AIです。

ユーザーのメッセージから以下の情報を抽出してください：

1. タスク内容（何をするか）
2. 締切日・期日（具体的な日時）
3. 現在時刻からの相対的な日数

出力形式（JSON）：
{
  "task": "タスク内容",
  "deadline": "YYYY-MM-DD HH:MM:SS形式の締切日時",
  "relativeDays": 数値（現在から何日後か）
}

注意事項：
- 締切日が明示されていない場合は、相対的な表現（「3日後」「来週」など）から現在時刻を基準に計算
- 時刻が指定されていない場合は "23:59:59" をデフォルトとする
- 日本時間（JST）で出力
- 現在時刻は ${currentDateString} です
- 現在の年は ${currentYear}年、月は ${currentMonth}月、日は ${currentDay}日です

例：
入力: "会議の準備 来週の金曜日"
出力: {"task": "会議の準備", "deadline": "2025-09-26 23:59:59", "relativeDays": 3}

入力: "資料作成 12月25日 15:00"
出力: {"task": "資料作成", "deadline": "2025-12-25 15:00:00", "relativeDays": 93}

入力: "プロジェクト締切 10月15日"
出力: {"task": "プロジェクト締切", "deadline": "2025-10-15 23:59:59", "relativeDays": 22}`
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
      deadline: new Date(parsed.deadline),
      relativeDays: parsed.relativeDays
    };
    
  } catch (error) {
    console.error('❌ AI解析エラー:', error.message);
    return null;
  }
}

// リマインダーを解析する関数（改良版）
async function parseReminderMessage(text) {
  // @Ryucle の後のテキストを抽出
  const mentionPattern = /@Ryucle\s+(.+)/i;
  const match = text.match(mentionPattern);
  
  if (!match) {
    return null;
  }
  
  const reminderText = match[1].trim();
  
  // AIを使って締切日を抽出
  const aiResult = await extractDeadlineWithAI(reminderText);
  
  if (!aiResult) {
    return null;
  }
  
  return {
    text: aiResult.task,
    deadline: aiResult.deadline,
    relativeDays: aiResult.relativeDays,
    createdAt: new Date()
  };
}

// 利用可能なリマインダー時刻を計算する関数
function calculateAvailableReminders(deadline) {
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
  
  const availableReminders = [];
  
  reminderTimes.forEach(({ offset, label }) => {
    const reminderTime = new Date(targetDate.getTime() + offset);
    
    console.log(`⏰ ${label}のリマインダー時刻: ${reminderTime.toLocaleString('ja-JP', { timeZone: TZ })}`);
    
    // 過去の時刻でない場合のみ追加
    if (reminderTime > now) {
      availableReminders.push({
        label: label,
        time: reminderTime,
        offset: offset
      });
      console.log(`✅ ${label}のリマインダーは利用可能`);
    } else {
      console.log(`❌ ${label}のリマインダーは過去の時刻のためスキップ`);
    }
  });
  
  console.log(`📊 利用可能なリマインダー: ${availableReminders.length}個`);
  return availableReminders;
}

// リマインダーをスケジュールする関数（改良版）
function scheduleReminders(reminderId, reminderInfo, channelId, userId) {
  const { text, deadline } = reminderInfo;
  
  const availableReminders = calculateAvailableReminders(deadline);
  
  if (availableReminders.length === 0) {
    console.log('⚠️ 利用可能なリマインダー時刻がありません');
    return false;
  }
  
  availableReminders.forEach(({ label, time, offset }) => {
    const timeoutDuration = time.getTime() - new Date().getTime();
    
    console.log(`⏰ ${label}リマインダーをスケジュール: ${time.toLocaleString('ja-JP', { timeZone: TZ })} (${Math.round(timeoutDuration / 1000 / 60)}分後)`);
    
    const timeoutId = setTimeout(async () => {
      try {
        console.log(`🔔 ${label}リマインダー実行: ${text}`);
        
        await slack.chat.postMessage({
          channel: channelId,
          text: `🔔 **リマインダー**\n\n${text}\n\n*${label}のリマインダーです*`,
          thread_ts: undefined // 新しいメッセージとして投稿
        });
        
        console.log(`✓ ${label}リマインダー送信完了`);
      } catch (error) {
        console.error(`❌ ${label}リマインダー送信エラー:`, error.message);
      }
    }, timeoutDuration);
    
    // タイムアウトIDを保存
    if (!reminders.has(reminderId)) {
      reminders.set(reminderId, []);
    }
    reminders.get(reminderId).push(timeoutId);
  });
  
  console.log(`📅 リマインダー設定完了: ${availableReminders.length}個のリマインダー`);
  return true;
}

// Ryucleがリマインダーに返答する関数（改良版）
async function respondToReminderRequest(userMessage, channelId, userId) {
  const reminderInfo = await parseReminderMessage(userMessage);
  
  if (!reminderInfo) {
    return `リュウクル参上だぞ🐲🔥\n\nリマインダーの設定方法:\n\`@Ryucle [タスク内容] [締切日時]\`\n\n例: \`@Ryucle 会議の準備 来週の金曜日\`\n\`@Ryucle 資料作成 12月25日 15:00\`\n\n期間は「3日後」「来週の金曜日」「12月25日」などで指定してくれよな🔥`;
  }
  
  const { text, deadline, relativeDays } = reminderInfo;
  const availableReminders = calculateAvailableReminders(deadline);
  
  if (availableReminders.length === 0) {
    return `リュウクル参上だぞ🐲🔥\n\n⚠️ **締切日が近すぎます！**\n\n📝 タスク: ${text}\n📅 締切: ${deadline.toLocaleString('ja-JP', { timeZone: TZ })}\n\n締切まで時間が短すぎて、リマインダーを設定できません...\nもう少し先の日付で設定し直してくれよな🔥`;
  }
  
  // 確認待ちとして保存
  const confirmationId = `${channelId}_${userId}_${Date.now()}`;
  pendingConfirmations.set(confirmationId, {
    reminderInfo,
    channelId,
    userId,
    createdAt: new Date()
  });
  
  // 確認メッセージを作成
  const reminderList = availableReminders.map(r => 
    `• ${r.label}: ${r.time.toLocaleString('ja-JP', { timeZone: TZ })}`
  ).join('\n');
  
  return `リュウクル参上だぞ🐲🔥\n\n✅ **リマインダー設定の確認**\n\n📝 タスク: ${text}\n📅 締切: ${deadline.toLocaleString('ja-JP', { timeZone: TZ })}\n🔔 リマインダー:\n${reminderList}\n\n**これで設定しますか？**\n\n✅ 設定する場合は「はい」または「OK」\n❌ 変更する場合は「@Ryucle キャンセル」と言ってから再投稿してくれよな🔥`;
}

// キャンセル処理の関数
function handleCancelRequest(userId, channelId) {
  // 該当ユーザーの確認待ちリマインダーをキャンセル
  let cancelledCount = 0;
  
  for (const [confirmationId, confirmation] of pendingConfirmations) {
    if (confirmation.userId === userId && confirmation.channelId === channelId) {
      pendingConfirmations.delete(confirmationId);
      cancelledCount++;
    }
  }
  
  return cancelledCount;
}

// 確認処理の関数
function handleConfirmation(userId, channelId) {
  // 該当ユーザーの確認待ちリマインダーを取得
  for (const [confirmationId, confirmation] of pendingConfirmations) {
    if (confirmation.userId === userId && confirmation.channelId === channelId) {
      // リマインダーをスケジュール
      const reminderId = `${channelId}_${userId}_${Date.now()}`;
      const success = scheduleReminders(reminderId, confirmation.reminderInfo, channelId, userId);
      
      // 確認待ちから削除
      pendingConfirmations.delete(confirmationId);
      
      return { success, reminderInfo: confirmation.reminderInfo };
    }
  }
  
  return { success: false, reminderInfo: null };
}

// Slack APIをポーリングしてメンションをチェックする関数
async function checkSlackMentions() {
  try {
    console.log('🔍 Slackメンションをチェック中...');
    
    // 最近のメッセージを取得（過去1時間）
    const oneHourAgo = Math.floor((Date.now() - 60 * 60 * 1000) / 1000);
    
    // 全チャンネルを取得
    const channelsResponse = await slack.conversations.list({
      types: 'public_channel,private_channel',
      limit: 1000
    });
    
    if (!channelsResponse.ok) {
      console.error('❌ チャンネル取得エラー:', channelsResponse.error);
      return;
    }
    
    console.log(`📋 ${channelsResponse.channels.length}個のチャンネルをチェック中`);
    
    for (const channel of channelsResponse.channels) {
      try {
        // チャンネルの最近のメッセージを取得
        const messagesResponse = await slack.conversations.history({
          channel: channel.id,
          oldest: oneHourAgo.toString(),
          limit: 50
        });
        
        if (!messagesResponse.ok) {
          console.log(`⚠️ チャンネル ${channel.name} のメッセージ取得エラー:`, messagesResponse.error);
          continue;
        }
        
        // @Ryucleメンションをチェック
        for (const message of messagesResponse.messages) {
          if (message.text && message.text.includes('@Ryucle') && !processedMessages.has(message.ts)) {
            console.log(`📨 新しい@Ryucleメンションを発見: ${message.text.substring(0, 50)}...`);
            
            // メッセージを処理
            await processMentionMessage(message, channel.id);
            
            // 処理済みとしてマーク
            processedMessages.add(message.ts);
          }
        }
      } catch (error) {
        console.error(`❌ チャンネル ${channel.name} の処理エラー:`, error.message);
      }
    }
    
    // 処理済みメッセージを保存
    saveProcessedMessages();
    
  } catch (error) {
    console.error('❌ Slackメンションチェックエラー:', error.message);
  }
}

// メンションメッセージを処理する関数
async function processMentionMessage(message, channelId) {
  try {
    const userId = message.user;
    const text = message.text;
    
    console.log(`📨 メンション処理: ${text}`);
    
    // ボット自身のメッセージを除外
    if (userId === message.bot_id) {
      return;
    }
    
    // キャンセル処理
    if (text.includes('@Ryucle') && text.includes('キャンセル')) {
      const cancelledCount = handleCancelRequest(userId, channelId);
      
      if (cancelledCount > 0) {
        await slack.chat.postMessage({
          channel: channelId,
          text: `リュウクル参上だぞ🐲🔥\n\n❌ **リマインダーをキャンセルしました！**\n\n${cancelledCount}個のリマインダー設定をキャンセルしたぞ！\n新しいリマインダーを設定したい場合は、もう一度投稿してくれよな🔥`,
          thread_ts: message.ts
        });
      } else {
        await slack.chat.postMessage({
          channel: channelId,
          text: `リュウクル参上だぞ🐲🔥\n\n⚠️ **キャンセルするリマインダーがありません**\n\n確認待ちのリマインダーがないぞ！\n新しいリマインダーを設定したい場合は、もう一度投稿してくれよな🔥`,
          thread_ts: message.ts
        });
      }
      return;
    }
    
    // 確認処理
    if (text.toLowerCase().includes('はい') || text.toLowerCase().includes('ok') || text.toLowerCase().includes('設定')) {
      const result = handleConfirmation(userId, channelId);
      
      if (result.success) {
        const { text: taskText, deadline } = result.reminderInfo;
        const availableReminders = calculateAvailableReminders(deadline);
        
        const reminderList = availableReminders.map(r => 
          `• ${r.label}: ${r.time.toLocaleString('ja-JP', { timeZone: TZ })}`
        ).join('\n');
        
        await slack.chat.postMessage({
          channel: channelId,
          text: `リュウクル参上だぞ🐲🔥\n\n✅ **リマインダー設定完了！**\n\n📝 タスク: ${taskText}\n📅 締切: ${deadline.toLocaleString('ja-JP', { timeZone: TZ })}\n🔔 リマインダー:\n${reminderList}\n\nオイラがちゃんと覚えておくから任せろだぞ🔥\n忘れたらドラゴンの名折れだからな！`,
          thread_ts: message.ts
        });
      } else {
        await slack.chat.postMessage({
          channel: channelId,
          text: `リュウクル参上だぞ🐲🔥\n\n⚠️ **確認待ちのリマインダーがありません**\n\nまずはリマインダーを設定してから確認してくれよな🔥`,
          thread_ts: message.ts
        });
      }
      return;
    }
    
    // メンション処理
    if (text.includes('@Ryucle')) {
      const response = await respondToReminderRequest(text, channelId, userId);
      
      await slack.chat.postMessage({
        channel: channelId,
        text: response,
        thread_ts: message.ts
      });
      
      console.log('✓ メンション返答送信完了');
    }
  } catch (error) {
    console.error('❌ メンション処理エラー:', error.message);
  }
}

// メイン実行関数
async function main() {
  try {
    console.log('🚀 Ryucleリマインダーボットが起動しました！');
    
    // 処理済みメッセージを読み込み
    loadProcessedMessages();
    
    // Slackメンションをチェック
    await checkSlackMentions();
    
    console.log('✅ メンションチェック完了');
    
  } catch (error) {
    console.error('❌ メイン実行エラー:', error.message);
    process.exit(1);
  }
}

// メイン実行
main();

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
  
  // 確認待ちのリマインダーをクリア
  pendingConfirmations.clear();
  
  // 処理済みメッセージを保存
  saveProcessedMessages();
  
  process.exit(0);
});

