import { WebClient } from '@slack/web-api';
import { toZonedTime } from 'date-fns-tz';

// Env vars
const slackToken = process.env.SLACK_BOT_TOKEN;
const channelId = process.env.SLACK_AIRCLE_CHANNEL_ID || 'C09BNPB16KW'; // #aircle-人材交流部
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
  const now = getCurrentDate();
  const dayOfWeek = now.toLocaleDateString('ja-JP', { weekday: 'long' });
  
  return `@channel

リュウクル参上！！

今日は週の${dayOfWeek}、19時のリマインドタイムだぞ！
交流会の準備はちゃんと進んでるか？

✅ 企画内容をしっかり詰めたか？
✅ Slackに【告知文＋画像】を投稿したか？
✅ 集客に向けてDMや追加告知をやったか？

もしまだなら👇
- まずは3人でミーティングを組んで企画を詰めろ！
- Slackに告知投稿を忘れるな！
- 集客目標が危うければ、今すぐ声かけを増やせ！

さらに大事なのがここだ👇
この入会フォーム（スプレッドシート）をチェックしろ！
https://docs.google.com/spreadsheets/d/1ZP9Of73A1FXZ1-EVKdeVHzV56MN7RWrd3bsNWyL-4zE/edit?usp=sharing

まだ面談やアプローチをしていない仲間がいたら、
@みおり（運営）、必ずチェックしてタスクを振ってくれ！
そして他のメンバーに1on1の日程調整を任せて、誰がやるか決めろ！

仲間が増えるのは最高に嬉しいことだ！
リュークル応援してるぞ！
ご視聴ありがとうございました！`;
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