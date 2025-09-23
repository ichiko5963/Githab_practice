import { WebClient } from '@slack/web-api';
import { toZonedTime } from 'date-fns-tz';

// Env vars
const slackToken = process.env.SLACK_BOT_TOKEN;
const channelId = process.env.SLACK_AIRCLE_MEETING_CHANNEL_ID || 'C09BNPB16KW'; // #aircle-週例mtg
const timezone = process.env.TZ || 'Asia/Tokyo';

if (!slackToken) {
  console.error('Missing SLACK_BOT_TOKEN');
  process.exit(1);
}

const client = new WebClient(slackToken);

// リュークルのキャラクター設定
const RYUUKURU_CONFIG = {
  name: 'リュークル',
  personality: 'お調子者＆ユーモラス、でも要件はきっちり伝える',
  pronoun: 'オイラ',
  catchphrase: 'リュウクル参上！！🐲🔥',
  ending: 'リュークル応援してるぞ！'
};

/**
 * 現在の日付を取得
 * @returns {Date} 日本時間の現在日時
 */
function getCurrentDate() {
  return toZonedTime(new Date(), timezone);
}

/**
 * 週例ミーティングリマインドメッセージを生成
 * @returns {string} リマインドメッセージ
 */
function generateWeeklyMeetingReminderMessage() {
  return `@channel

${RYUUKURU_CONFIG.catchphrase}

今週の定例どうだった？みんなちゃんと参加できたか？
もし参加できなかったやつは、議事録を必ず見ろよ！

議事録はいちおかが投稿してるはずだ。
このチャンネルに上がってるから確認しろ！
もしまだ投稿されてなかったら、いちおかにリマインドして必ず送らせろ！

そして大事なのはこれだ👇
議事録を見たら必ずリアクションをつけろ！👀
「見た証拠」が残らないと意味がないからな！

${RYUUKURU_CONFIG.ending}`;
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
      link_names: true,
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
  console.log('🚀 リュークル週例ミーティングリマインドを開始します...');
  
  // チャンネル検証
  const isValidChannel = await validateChannel();
  if (!isValidChannel) {
    process.exit(1);
  }

  // 現在時刻を取得
  const now = getCurrentDate();
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
  
  // メッセージを生成
  const message = generateWeeklyMeetingReminderMessage();
  console.log('📝 週例ミーティングリマインドメッセージを生成しました');
  
  // Slackに投稿
  await postReminderMessage(message);
  
  console.log('✅ リュークル週例ミーティングリマインドが完了しました');
}

// エラーハンドリング
main().catch((error) => {
  console.error('❌ 予期しないエラーが発生しました:', error);
  process.exit(1);
});