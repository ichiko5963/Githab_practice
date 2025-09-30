import { WebClient } from '@slack/web-api';
import { startOfDay, isAfter, isBefore, format } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

// Env vars
const slackToken = process.env.SLACK_BOT_TOKEN;
const channelId = process.env.SLACK_ZATSUDAN_CHANNEL_ID; // #3-雑談_質問部屋
const reportChannelId = process.env.SLACK_KEIEI_CHANNEL_ID; // #aircle-経営部
const timezone = process.env.TZ || 'Asia/Tokyo';

if (!slackToken) {
  console.log('⚠️  SLACK_BOT_TOKENが設定されていません。テストモードで実行します。');
  console.log('📝 生成されるメッセージ:');
  console.log('='.repeat(50));
}

// Slackクライアントの初期化
const slack = new WebClient(slackToken);

/**
 * 指定されたチャンネルのメッセージを取得
 */
async function fetchChannelMessages(channel) {
  const messages = [];
  let cursor;
  
  try {
    do {
      const res = await slack.conversations.history({
        channel,
        cursor,
        limit: 200
      });
      
      if (!res.ok) {
        throw new Error(`Slack API error: ${res.error}`);
      }
      
      messages.push(...(res.messages || []));
      cursor = res.response_metadata?.next_cursor;
    } while (cursor);
    
    return messages;
  } catch (error) {
    console.error('❌ メッセージ取得エラー:', error.message);
    throw error;
  }
}

/**
 * 今日の0:00以降に投稿されたメッセージがあるかチェック
 */
function hasMessagesToday(messages) {
  const now = new Date();
  const todayStart = startOfDay(toZonedTime(now, timezone));
  const todayStartUtc = fromZonedTime(todayStart, timezone);
  
  console.log(`📅 チェック対象期間: ${format(todayStartUtc, 'yyyy-MM-dd HH:mm:ss')} UTC 以降`);
  
  for (const message of messages) {
    // メッセージのタイムスタンプをDateオブジェクトに変換
    const messageTime = new Date(parseFloat(message.ts) * 1000);
    
    // 今日の0:00以降のメッセージかチェック
    if (isAfter(messageTime, todayStartUtc)) {
      console.log(`✅ 今日の投稿を発見: ${format(messageTime, 'yyyy-MM-dd HH:mm:ss')} UTC`);
      console.log(`📝 メッセージ: ${(message.text || '').substring(0, 100)}...`);
      return true;
    }
  }
  
  console.log('❌ 今日の投稿は見つかりませんでした');
  return false;
}

/**
 * 曜日ごとの担当者を取得
 */
function getTodayResponsible() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=日曜, 1=月曜, 2=火曜, ...
  
  const responsible = {
    1: '大山 竜輝', // 月曜
    2: '市岡 直人', // 火曜
    3: '折井 英人', // 水曜
    4: '笹木 澪莉', // 木曜
    5: '大前 綾香', // 金曜
    6: '澁澤 圭佑'  // 土曜
  };
  
  return responsible[dayOfWeek] || null;
}

/**
 * 曜日名を取得
 */
function getDayName() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  
  const dayNames = {
    1: '月曜',
    2: '火曜', 
    3: '水曜',
    4: '木曜',
    5: '金曜',
    6: '土曜'
  };
  
  return dayNames[dayOfWeek] || null;
}

/**
 * 経営部への担当者リマインドメッセージを送信
 */
async function sendResponsibleReminder() {
  try {
    console.log('経営部への担当者リマインドを送信中...');

    const todayResponsible = getTodayResponsible();
    const dayName = getDayName();
    
    if (!todayResponsible || !dayName) {
      console.log('📅 今日は担当者がいない日（日曜日）です');
      return;
    }

    const reportMessage = `リュウクル参上！！🐲🔥

今日は${dayName}だぞ！
今日の担当者は **${todayResponsible}** さんだ！

${todayResponsible}さん、今日もよろしくお願いします！
リュークルが応援してるぞ〜💪

頑張れ！頑張れ！`;

    // トークンが設定されていない場合はテストモード
    if (!slackToken) {
      console.log('📋 経営部への担当者リマインドメッセージ:');
      console.log('='.repeat(50));
      console.log(reportMessage);
      console.log('='.repeat(50));
      console.log('✅ テストモード: リマインドメッセージが正常に生成されました');
      console.log(`📢 報告先チャンネル: ${reportChannelId || 'SLACK_KEIEI_CHANNEL_ID未設定'}`);
      console.log(`👤 今日の担当者: ${todayResponsible}`);
      console.log(`📅 曜日: ${dayName}`);
      return;
    }

    const result = await slack.chat.postMessage({
      channel: reportChannelId,
      text: reportMessage,
      username: 'リュークル',
      icon_emoji: ':dragon:'
    });

    if (result.ok) {
      console.log('✅ 経営部への担当者リマインドを送信しました');
      console.log(`📅 送信時刻: ${new Date().toLocaleString('ja-JP')}`);
      console.log(`👤 今日の担当者: ${todayResponsible}`);
    } else {
      console.error('❌ リマインドメッセージ送信に失敗しました:', result.error);
    }

  } catch (error) {
    console.error('❌ リマインドメッセージ送信でエラーが発生しました:', error.message);
    throw error;
  }
}

/**
 * メイン処理
 */
async function main() {
  try {
    console.log('🚀 りゅうクル雑談チャンネルチェック開始');
    console.log(`📅 実行時刻: ${new Date().toLocaleString('ja-JP')}`);
    console.log(`🌏 タイムゾーン: ${timezone}`);
    
    if (!channelId) {
      console.error('❌ SLACK_ZATSUDAN_CHANNEL_IDが設定されていません');
      console.log('📝 テストモードでリマインドメッセージを表示します:');
      console.log('='.repeat(50));
      await sendResponsibleReminder();
      return;
    }
    
    console.log(`📢 対象チャンネル: ${channelId}`);
    
    // 経営部に担当者リマインドを送信
    console.log('📋 経営部への担当者リマインドを送信します');
    await sendResponsibleReminder();
    
    console.log('🎉 処理完了');
    
  } catch (error) {
    console.error('❌ メイン処理でエラーが発生しました:', error.message);
    process.exit(1);
  }
}

// スクリプトが直接実行された場合
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as checkChatChannelAndRemind };
