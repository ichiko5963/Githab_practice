import { WebClient } from '@slack/web-api';
import { utcToZonedTime } from 'date-fns-tz';

// Env vars
const slackToken = process.env.SLACK_BOT_TOKEN;
const channelId = process.env.SLACK_X_REMINDER_CHANNEL_ID; // #aircle-対面イベント企画部
const timezone = process.env.TZ || 'Asia/Tokyo';

if (!slackToken || !channelId) {
  console.error('Missing SLACK_BOT_TOKEN or SLACK_X_REMINDER_CHANNEL_ID');
  process.exit(1);
}

const client = new WebClient(slackToken);

// リュークルのキャラクター設定
const RYUUKURU_CONFIG = {
  name: 'リュークル',
  personality: 'お調子者＆ユーモラス、AI大好き',
  pronoun: 'オイラ',
  catchphrase: 'リュウクル参上！！🐲🔥',
  ending: 'オイラはちゃんと見張ってるぞ！'
};

// メンション対象のユーザーID（実際のSlackのユーザーIDに置き換える必要があります）
const MENTION_USERS = {
  yoshiki: 'U09E5D867PX', // @よしき(運営) の実際のユーザーID
  ryosei: 'U09C1AQK8LF'   // @りょうせい（運営）の実際のユーザーID
};

/**
 * 現在の日付が奇数日かどうかを判定
 * @returns {boolean} 奇数日の場合true
 */
function isOddDay() {
  const now = utcToZonedTime(new Date(), timezone);
  const day = now.getDate();
  return day % 2 === 1;
}

/**
 * 毎日のX投稿確認リマインドメッセージを生成
 * @returns {string} リマインドメッセージ
 */
function generateDailyReminderMessage() {
  return `${RYUUKURU_CONFIG.catchphrase}\n<@${MENTION_USERS.yoshiki}>、今日の教文のX投稿はもう済ませたか？\nオイラは毎晩20時に見張ってるから、もし忘れてたら今すぐやっちまうんだぞ！\n\n${RYUUKURU_CONFIG.ending}`;
}

/**
 * 奇数日のX投稿確認リマインドメッセージを生成
 * @returns {string} リマインドメッセージ
 */
function generateOddDayReminderMessage() {
  return `${RYUUKURU_CONFIG.catchphrase}\n<@${MENTION_USERS.yoshiki}> <@${MENTION_USERS.ryosei}>、今日は奇数日だぞ。\n対面イベント用のX投稿はちゃんと済ませたか？\nもしまだなら今すぐ投稿してくれよな、オイラがずっと見張ってるぞ！\n\n${RYUUKURU_CONFIG.ending}`;
}

/**
 * Slackにリマインドメッセージを投稿
 * @param {string} message - 投稿するメッセージ
 */
async function postReminderMessage(message) {
  try {
    const result = await client.chat.postMessage({
      channel: channelId,
      text: message,
      unfurl_links: false,
      unfurl_media: false
    });

    if (result.ok) {
      console.log('✅ リマインドメッセージを正常に投稿しました');
      console.log(`📝 メッセージ: ${message.replace(/\n/g, ' ')}`);
    } else {
      console.error('❌ メッセージ投稿に失敗しました:', result.error);
    }
  } catch (error) {
    console.error('❌ メッセージ投稿中にエラーが発生しました:', error);
  }
}

/**
 * チャンネル情報を取得して検証
 */
async function validateChannel() {
  try {
    const channelInfo = await client.conversations.info({ channel: channelId });
    if (!channelInfo.ok) {
      console.error('❌ チャンネル情報の取得に失敗しました:', channelInfo.error);
      return false;
    }
    
    console.log(`📢 対象チャンネル: #${channelInfo.channel.name}`);
    return true;
  } catch (error) {
    console.error('❌ チャンネル検証中にエラーが発生しました:', error);
    return false;
  }
}

/**
 * メイン処理
 */
async function main() {
  console.log('🚀 リュークルX投稿確認リマインドを開始します...');
  
  // チャンネル検証
  const isValidChannel = await validateChannel();
  if (!isValidChannel) {
    process.exit(1);
  }

  // 現在時刻を取得
  const now = utcToZonedTime(new Date(), timezone);
  const currentTime = now.toLocaleString('ja-JP', { 
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  
  console.log(`⏰ 実行時刻: ${currentTime} (${timezone})`);
  
  // 奇数日かどうかを判定
  const isOdd = isOddDay();
  console.log(`📅 今日は${isOdd ? '奇数日' : '偶数日'}です`);
  
  // メッセージを生成して投稿
  let message;
  if (isOdd) {
    message = generateOddDayReminderMessage();
    console.log('📝 奇数日用のリマインドメッセージを生成しました');
  } else {
    message = generateDailyReminderMessage();
    console.log('📝 毎日用のリマインドメッセージを生成しました');
  }
  
  // Slackに投稿
  await postReminderMessage(message);
  
  console.log('✅ リュークルX投稿確認リマインドが完了しました');
}

// エラーハンドリング
main().catch((error) => {
  console.error('❌ 予期しないエラーが発生しました:', error);
  process.exit(1);
});
