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
const isTestMode = args.includes('--test-schedule') || args.includes('--test-check');

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
    
    // チャンネルIDを取得（エラーハンドリングを強化）
    let channelList;
    try {
      channelList = await slack.conversations.list({
        types: 'public_channel,private_channel',
        exclude_archived: true
      });
    } catch (listError) {
      console.error(`❌ チャンネルリスト取得エラー:`, listError.message);
      if (listError.message.includes('missing_scope')) {
        console.log(`💡 必要なスコープ: channels:read, groups:read`);
      }
      return -1;
    }
    
    const channel = channelList.channels.find(ch => ch.name === channelName);
    if (!channel) {
      console.log(`⚠️ チャンネル ${channelName} が見つかりません`);
      return -1; // エラーを示す
    }
    
    console.log(`📍 チャンネルID: ${channel.id}`);
    
    // 今日の開始時刻（JST）を計算
    const now = new Date();
    const jstNow = toZonedTime(now, TZ);
    const todayStart = new Date(jstNow.getFullYear(), jstNow.getMonth(), jstNow.getDate(), 0, 0, 0);
    const todayStartUTC = fromZonedTime(todayStart, TZ);
    
    // 今日の終了時刻（JST）を計算
    const todayEnd = new Date(jstNow.getFullYear(), jstNow.getMonth(), jstNow.getDate(), 23, 59, 59);
    const todayEndUTC = fromZonedTime(todayEnd, TZ);
    
    console.log(`📅 チェック期間: ${format(todayStartUTC, 'yyyy-MM-dd HH:mm:ss')} - ${format(todayEndUTC, 'yyyy-MM-dd HH:mm:ss')}`);
    
    // チャンネルの履歴を取得（エラーハンドリングを強化）
    let history;
    try {
      history = await slack.conversations.history({
        channel: channel.id,
        oldest: (todayStartUTC.getTime() / 1000).toString(),
        latest: (todayEndUTC.getTime() / 1000).toString(),
        limit: 1000,
        inclusive: true
      });
    } catch (historyError) {
      console.error(`❌ チャンネル履歴取得エラー:`, historyError.message);
      if (historyError.message.includes('missing_scope')) {
        console.log(`💡 必要なスコープ: channels:history, groups:history`);
      }
      return -1;
    }
    
    // ボット自身のメッセージを除外してカウント
    const botUserId = await getBotUserId();
    const userMessages = history.messages.filter(msg => {
      // 通常のメッセージのみをカウント（subtypeがないメッセージ）
      if (msg.subtype) {
        return false;
      }
      // ボット自身のメッセージを除外
      if (msg.user === botUserId) {
        return false;
      }
      return true;
    });
    
    const postCount = userMessages.length;
    console.log(`✓ ${channelName}: ${postCount}件の投稿を確認`);
    
    // デバッグ用：メッセージの詳細を表示
    if (postCount > 0) {
      console.log(`📝 投稿例:`, userMessages.slice(0, 3).map(msg => ({
        user: msg.user,
        text: msg.text?.substring(0, 50) + '...',
        timestamp: format(new Date(parseFloat(msg.ts) * 1000), 'HH:mm:ss')
      })));
    }
    
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
async function sendNotificationToModerationTeam(channelName, moderationChannel, targetDate, isTodayOdd) {
  try {
    console.log(`📢 ${moderationChannel} に通知を送信中...`);
    
    let message;
    
    if (isTodayOdd) {
      // 今日が奇数の日の場合
      message = `リュウクル参上！
今日は奇数日だぞ。
まだ今日の投稿がなさそうだから、20時までに忘れずに投下してくれよな。
オイラ、ちゃんと見張ってるから頼んだぞ！`;
    } else {
      // 昨日が奇数の日の場合
      message = `リュウクル参上！
オイラのチェックによると、昨日は奇数日なのに投稿ゼロ…。
これはもったいないぞ。
今からでも遅くないから、リカバーしてくれよな！`;
    }
    
    await slack.chat.postMessage({
      channel: moderationChannel,
      text: message
    });
    
    console.log(`✓ ${moderationChannel} への通知送信完了`);
    
  } catch (error) {
    console.error(`❌ ${moderationChannel} への通知送信エラー:`, error.message);
  }
}

/**
 * 指定された日付が奇数の日かどうかを判定
 */
function isOddDay(date) {
  const checkDate = parseISO(date);
  const day = checkDate.getDate();
  return day % 2 === 1; // 奇数の日
}

/**
 * 指定された日付がチェック対象日かどうかを判定
 * 奇数の日の投稿をチェックする
 */
function isCheckTargetDate(date) {
  const startDate = parseISO(START_DATE);
  const checkDate = parseISO(date);
  
  // 開始日より前の場合は対象外
  if (isBefore(checkDate, startDate)) {
    return false;
  }
  
  // 奇数の日のみが対象
  return isOddDay(date);
}

/**
 * 前の奇数の日を取得
 */
function getPreviousOddDay(date) {
  const checkDate = parseISO(date);
  let previousDay = addDays(checkDate, -1);
  
  // 奇数の日になるまで遡る
  while (!isOddDay(format(previousDay, 'yyyy-MM-dd'))) {
    previousDay = addDays(previousDay, -1);
  }
  
  return format(previousDay, 'yyyy-MM-dd');
}

/**
 * 指定された日の投稿数をチェック
 */
async function checkChannelPostsForDate(channelName, targetDate) {
  try {
    console.log(`📊 ${channelName} の ${targetDate} の投稿数を確認中...`);
    
    // チャンネルIDを取得
    let channelList;
    try {
      channelList = await slack.conversations.list({
        types: 'public_channel,private_channel',
        exclude_archived: true
      });
    } catch (listError) {
      console.error(`❌ チャンネルリスト取得エラー:`, listError.message);
      return -1;
    }
    
    const channel = channelList.channels.find(ch => ch.name === channelName);
    if (!channel) {
      console.log(`⚠️ チャンネル ${channelName} が見つかりません`);
      return -1;
    }
    
    // 指定日の開始時刻（JST）を計算
    const targetDateObj = parseISO(targetDate);
    const dayStart = new Date(targetDateObj.getFullYear(), targetDateObj.getMonth(), targetDateObj.getDate(), 0, 0, 0);
    const dayStartUTC = fromZonedTime(dayStart, TZ);
    
    // 指定日の終了時刻（JST）を計算
    const dayEnd = new Date(targetDateObj.getFullYear(), targetDateObj.getMonth(), targetDateObj.getDate(), 23, 59, 59);
    const dayEndUTC = fromZonedTime(dayEnd, TZ);
    
    console.log(`📅 チェック期間: ${format(dayStartUTC, 'yyyy-MM-dd HH:mm:ss')} - ${format(dayEndUTC, 'yyyy-MM-dd HH:mm:ss')}`);
    
    // チャンネルの履歴を取得
    let history;
    try {
      history = await slack.conversations.history({
        channel: channel.id,
        oldest: (dayStartUTC.getTime() / 1000).toString(),
        latest: (dayEndUTC.getTime() / 1000).toString(),
        limit: 1000,
        inclusive: true
      });
    } catch (historyError) {
      console.error(`❌ チャンネル履歴取得エラー:`, historyError.message);
      return -1;
    }
    
    // ボット自身のメッセージを除外してカウント
    const botUserId = await getBotUserId();
    const userMessages = history.messages.filter(msg => {
      if (msg.subtype) {
        return false;
      }
      if (msg.user === botUserId) {
        return false;
      }
      return true;
    });
    
    const postCount = userMessages.length;
    console.log(`✓ ${channelName} (${targetDate}): ${postCount}件の投稿を確認`);
    
    return postCount;
    
  } catch (error) {
    console.error(`❌ ${channelName} の投稿数取得エラー:`, error.message);
    return -1;
  }
}

/**
 * メインのモデレーションチェック処理
 */
async function performModerationCheck() {
  try {
    console.log('🔍 モデレーションチェック開始');
    
    const today = format(new Date(), 'yyyy-MM-dd');
    console.log(`📅 今日の日付: ${today}`);
    
    let targetDate;
    
    if (isOddDay(today)) {
      // 今日が奇数の日の場合、今日の投稿をチェック
      targetDate = today;
      console.log(`✓ 今日は奇数の日です。${targetDate} の投稿をチェックします`);
    } else {
      // 今日が偶数の日の場合、前の奇数の日の投稿をチェック
      targetDate = getPreviousOddDay(today);
      console.log(`ℹ️ 今日は偶数の日です。前の奇数の日 ${targetDate} の投稿をチェックします`);
    }
    
    // 各チャンネルをチェック
    for (const [channelName, moderationChannel] of Object.entries(CHANNEL_MAPPING)) {
      console.log(`\n--- ${channelName} チェック開始 ---`);
      
      const postCount = await checkChannelPostsForDate(channelName, targetDate);
      
      if (postCount === -1) {
        console.log(`⚠️ ${channelName} のチェックをスキップ（エラー）`);
        continue;
      }
      
      if (postCount === 0) {
        console.log(`🚨 ${channelName} に ${targetDate} の投稿がありません！通知を送信します`);
        await sendNotificationToModerationTeam(channelName, moderationChannel, targetDate, isOddDay(today));
      } else {
        console.log(`✅ ${channelName} に ${targetDate} の投稿が ${postCount} 件あります`);
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
    '2025-09-19', // 奇数の日
    '2025-09-20', // 偶数の日
    '2025-09-21', // 奇数の日
    '2025-09-22', // 偶数の日
    '2025-09-23', // 奇数の日
    '2025-09-30', // 偶数の日
    '2025-10-01', // 奇数の日
  ];
  
  console.log('奇数の日の判定結果:');
  testDates.forEach(date => {
    const isOdd = isOddDay(date);
    const previousOdd = isOdd ? date : getPreviousOddDay(date);
    console.log(`${date}: ${isOdd ? '✅ 奇数の日' : '❌ 偶数の日'} ${isOdd ? '' : `(前の奇数の日: ${previousOdd})`}`);
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
