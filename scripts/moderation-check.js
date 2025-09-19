import { WebClient } from '@slack/web-api';
import { format, isAfter, isBefore, addDays, parseISO } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

// 設定
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const TZ = 'Asia/Tokyo';

// デバッグ情報を出力
console.log('=== Slackモデレーションチェックボット 開始 ===');
console.log('環境変数チェック:');
console.log('- SLACK_BOT_TOKEN:', SLACK_BOT_TOKEN ? '✓ 設定済み' : '✗ 未設定');
console.log('- TZ:', TZ);

// 必須環境変数のチェック（テストモードではスキップ）
const args = process.argv.slice(2);
const isTestMode = args.includes('--test-schedule');

if (!SLACK_BOT_TOKEN && !isTestMode) {
  console.error('❌ SLACK_BOT_TOKEN が設定されていません');
  process.exit(1);
}

// Slackクライアント初期化
const slack = new WebClient(SLACK_BOT_TOKEN);

// 対象チャンネルと運営チームのマッピング
const CHANNEL_MAPPING = {
  '81_chatgpt': 'chatgpt_運営チーム',
  '82_gemini-notebooklm': 'gemini_運営チーム',
  '83_claude': 'claude_運営チーム',
  '84_manus-genspark': 'genspark_manus_運営チーム',
  '85_suno-udio-veo3-midjourney-sora': 'suno_運営チーム',
  '86_n8n-dify-zapier': 'n8n-dify-zapier_運営チーム',
  '87_画像生成ai': 'veo3-midjourney-sora_運営チーム'
};

// スケジュール設定
const START_DATE = '2025-09-19'; // 開始日
const CHECK_TIME = '20:00'; // チェック時刻

/**
 * 指定されたチャンネルの当日の投稿数を取得
 */
async function getChannelPostCount(channelName) {
  try {
    console.log(`📊 ${channelName} の投稿数を確認中...`);
    
    // チャンネルIDを取得
    const channelList = await slack.conversations.list({
      types: 'public_channel,private_channel'
    });
    
    const channel = channelList.channels.find(ch => ch.name === channelName);
    if (!channel) {
      console.log(`⚠️ チャンネル ${channelName} が見つかりません`);
      return -1; // エラーを示す
    }
    
    // 今日の開始時刻（JST）を計算
    const now = new Date();
    const jstNow = toZonedTime(now, TZ);
    const todayStart = new Date(jstNow.getFullYear(), jstNow.getMonth(), jstNow.getDate(), 0, 0, 0);
    const todayStartUTC = fromZonedTime(todayStart, TZ);
    
    // 今日の終了時刻（JST）を計算
    const todayEnd = new Date(jstNow.getFullYear(), jstNow.getMonth(), jstNow.getDate(), 23, 59, 59);
    const todayEndUTC = fromZonedTime(todayEnd, TZ);
    
    console.log(`📅 チェック期間: ${format(todayStartUTC, 'yyyy-MM-dd HH:mm:ss')} - ${format(todayEndUTC, 'yyyy-MM-dd HH:mm:ss')}`);
    
    // チャンネルの履歴を取得
    const history = await slack.conversations.history({
      channel: channel.id,
      oldest: (todayStartUTC.getTime() / 1000).toString(),
      latest: (todayEndUTC.getTime() / 1000).toString(),
      limit: 1000
    });
    
    // ボット自身のメッセージを除外してカウント
    const botUserId = await getBotUserId();
    const userMessages = history.messages.filter(msg => 
      msg.user !== botUserId && 
      msg.subtype !== 'channel_join' && 
      msg.subtype !== 'channel_leave' &&
      msg.subtype !== 'channel_topic' &&
      msg.subtype !== 'channel_purpose'
    );
    
    const postCount = userMessages.length;
    console.log(`✓ ${channelName}: ${postCount}件の投稿を確認`);
    
    return postCount;
    
  } catch (error) {
    console.error(`❌ ${channelName} の投稿数取得エラー:`, error.message);
    return -1; // エラーを示す
  }
}

/**
 * ボットのユーザーIDを取得
 */
async function getBotUserId() {
  try {
    const auth = await slack.auth.test();
    return auth.user_id;
  } catch (error) {
    console.error('❌ ボットユーザーID取得エラー:', error.message);
    return null;
  }
}

/**
 * 運営チームチャンネルに通知を送信
 */
async function sendNotificationToModerationTeam(channelName, moderationChannel) {
  try {
    console.log(`📢 ${moderationChannel} に通知を送信中...`);
    
    const message = `#${channelName} で今日まだ投稿がありません。ご確認ください。`;
    
    await slack.chat.postMessage({
      channel: moderationChannel,
      text: message,
      username: 'モデレーションボット',
      icon_emoji: ':warning:'
    });
    
    console.log(`✓ ${moderationChannel} への通知送信完了`);
    
  } catch (error) {
    console.error(`❌ ${moderationChannel} への通知送信エラー:`, error.message);
  }
}

/**
 * 指定された日付がチェック対象日かどうかを判定
 */
function isCheckTargetDate(date) {
  const startDate = parseISO(START_DATE);
  const checkDate = parseISO(date);
  
  // 開始日より前の場合は対象外
  if (isBefore(checkDate, startDate)) {
    return false;
  }
  
  // 開始日からの経過日数を計算
  const daysDiff = Math.floor((checkDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // 2日おきのスケジュール（0, 2, 4, 6...）
  return daysDiff % 2 === 0;
}

/**
 * メインのモデレーションチェック処理
 */
async function performModerationCheck() {
  try {
    console.log('🔍 モデレーションチェック開始');
    
    const today = format(new Date(), 'yyyy-MM-dd');
    console.log(`📅 チェック対象日: ${today}`);
    
    // 今日がチェック対象日かどうかを確認
    if (!isCheckTargetDate(today)) {
      console.log(`ℹ️ ${today} はチェック対象日ではありません（2日おきのスケジュール）`);
      return;
    }
    
    console.log(`✓ ${today} はチェック対象日です`);
    
    // 各チャンネルをチェック
    for (const [channelName, moderationChannel] of Object.entries(CHANNEL_MAPPING)) {
      console.log(`\n--- ${channelName} チェック開始 ---`);
      
      const postCount = await getChannelPostCount(channelName);
      
      if (postCount === -1) {
        console.log(`⚠️ ${channelName} のチェックをスキップ（エラー）`);
        continue;
      }
      
      if (postCount === 0) {
        console.log(`🚨 ${channelName} に投稿がありません！通知を送信します`);
        await sendNotificationToModerationTeam(channelName, moderationChannel);
      } else {
        console.log(`✅ ${channelName} に ${postCount} 件の投稿があります`);
      }
      
      // API制限を避けるため少し待機
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n🎉 モデレーションチェック完了');
    
  } catch (error) {
    console.error('❌ モデレーションチェックエラー:', error.message);
  }
}

/**
 * スケジュールテスト用関数（手動実行時）
 */
async function testSchedule() {
  console.log('🧪 スケジュールテスト');
  
  const testDates = [
    '2025-09-19', // 開始日
    '2025-09-20', // 1日後（対象外）
    '2025-09-21', // 2日後（対象）
    '2025-09-22', // 3日後（対象外）
    '2025-09-23', // 4日後（対象）
    '2025-09-30', // 11日後（対象外）
    '2025-10-01', // 12日後（対象）
  ];
  
  console.log('チェック対象日の判定結果:');
  testDates.forEach(date => {
    const isTarget = isCheckTargetDate(date);
    console.log(`${date}: ${isTarget ? '✅ 対象' : '❌ 対象外'}`);
  });
}

// メイン実行
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--test-schedule')) {
    await testSchedule();
    return;
  }
  
  if (args.includes('--test-check')) {
    console.log('🧪 テストモードでチェック実行');
    await performModerationCheck();
    return;
  }
  
  // 通常実行
  await performModerationCheck();
}

// エラーハンドリング
process.on('uncaughtException', (error) => {
  console.error('❌ 未処理の例外:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未処理のPromise拒否:', reason);
  process.exit(1);
});

// スクリプト実行
main().catch(error => {
  console.error('❌ メイン処理エラー:', error);
  process.exit(1);
});
