import { WebClient } from '@slack/web-api';
import { utcToZonedTime } from 'date-fns-tz';

// Env vars
const slackToken = process.env.SLACK_BOT_TOKEN;
const timezone = process.env.TZ || 'Asia/Tokyo';

if (!slackToken) {
  console.error('Missing SLACK_BOT_TOKEN');
  process.exit(1);
}

const client = new WebClient(slackToken);

// 対象チャンネルID（環境変数から取得）
const TEAM_CHANNELS = {
  chatgpt: process.env.SLACK_CHATGPT_TEAM_CHANNEL_ID,
  claude: process.env.SLACK_CLAUDE_TEAM_CHANNEL_ID,
  gemini: process.env.SLACK_GEMINI_TEAM_CHANNEL_ID,
  genspark_manus: process.env.SLACK_GENSPARK_MANUS_TEAM_CHANNEL_ID,
  n8n_dify_zapier: process.env.SLACK_N8N_DIFY_ZAPIER_TEAM_CHANNEL_ID,
  suno: process.env.SLACK_SUNO_TEAM_CHANNEL_ID,
  image_ai: process.env.SLACK_IMAGE_AI_TEAM_CHANNEL_ID
};

// リュークルのキャラクター設定
const RYUUKURU_CONFIG = {
  name: 'リュークル',
  personality: 'お調子者＆ユーモラス、でも要件はしっかり伝える',
  pronoun: 'オイラ',
  catchphrase: 'リュウクル参上！！🐲🔥',
  ending: 'オイラは定期的に見張ってるから、忘れたらすぐバレるぞ！',
  closing: 'ご視聴ありがとうございました！'
};

/**
 * 現在の日付を取得
 * @returns {Date} 日本時間の現在日時
 */
function getCurrentDate() {
  return utcToZonedTime(new Date(), timezone);
}

/**
 * 現在の日付がリマインド対象日かどうかを判定
 * @returns {boolean} リマインド対象日の場合true
 */
function isReminderDay() {
  const now = getCurrentDate();
  const day = now.getDate();
  return [3, 6, 24, 27, 30].includes(day);
}

/**
 * メッセージパターンを判定
 * @returns {string} 'A' または 'B'
 */
function getMessagePattern() {
  const now = getCurrentDate();
  const day = now.getDate();
  
  // 24日・27日・30日はパターンA（準備・進捗確認）
  if ([24, 27, 30].includes(day)) {
    return 'A';
  }
  // 3日・6日はパターンB（最終追い込み確認）
  else if ([3, 6].includes(day)) {
    return 'B';
  }
  
  return 'A'; // デフォルト
}

/**
 * パターンAのメッセージを生成（準備・進捗確認）
 * @returns {string} リマインドメッセージ
 */
function generatePatternAMessage() {
  return `${RYUUKURU_CONFIG.catchphrase}

来月10日までに勉強会をやるのは決まりだ！準備は進んでるか？

✅ 企画内容はしっかり詰めたか？
✅ Slackに【告知文＋画像】を投稿したか？（文章は自分たちで考えるんだぞ！）
✅ Xに告知投稿をしたか？

もしまだならこう動け👇

相方にこのチャットルームで 1on1の日付 を連絡！

1on1で企画を詰めて、マニュアル型に当てはめてドキュメント化👇
https://docs.google.com/document/d/1OxFEJPfIRZpma-Ik5cm-yJZ1nM8KNOyHC55Hi28ggl0/edit

ドキュメントができたら、自分たちで会議URLを発行してSlackに投稿！リマインドも自分たちでやるんだぞ！

ドキュメントを @大山竜輝（運営｜マーケ&デザイン部） に送って、ビジュアルを依頼！

DMには「アピールポイント＋期限（○日○時まで）」を必ず入れろ！

期限までに返事がなければ追撃だ！

ビジュアル完成後はXに投稿したか自分たちで確認！

${RYUUKURU_CONFIG.ending}〜！
${RYUUKURU_CONFIG.closing}`;
}

/**
 * パターンBのメッセージを生成（最終追い込み確認）
 * @returns {string} リマインドメッセージ
 */
function generatePatternBMessage() {
  return `${RYUUKURU_CONFIG.catchphrase}

今月10日までに勉強会をやるって約束だ！今日は最終確認の日だぞ！
ここで動けなきゃ、勉強会そのものが崩れるから覚悟しろ！

🔥 Slackで告知文＋画像は投稿済みか？最低3回はやったか？
🔥 Xでも投稿したか？まだなら即行動！
🔥 集客目標の人数は本当に達成できそうか？

もし抜けてるなら即対応👇

相方とすぐに1on1を組んで最終詰め！

ドキュメントを整えて、大山竜輝（運営｜マーケ&デザイン部）に「アピールポイント＋期限」を入れてDM！

期限までに返事が来なければ、しつこくでも連絡を続けろ！

ビジュアルが返ってきたら、SlackとXで必ず再告知！

ここで甘えたら終わりだ！最後の追い込みで勉強会を成立させろ！
${RYUUKURU_CONFIG.ending}！！`;
}

/**
 * Slackにリマインドメッセージを投稿
 * @param {string} channelId - 投稿先チャンネルID
 * @param {string} message - 投稿するメッセージ
 * @param {string} channelName - チャンネル名（ログ用）
 */
async function postReminderMessage(channelId, message, channelName) {
  if (!channelId) {
    console.log(`⚠️  ${channelName}のチャンネルIDが設定されていません`);
    return;
  }

  try {
    const result = await client.chat.postMessage({
      channel: channelId,
      text: message,
      unfurl_links: false,
      unfurl_media: false
    });

    if (result.ok) {
      console.log(`✅ ${channelName}にリマインドメッセージを正常に投稿しました`);
    } else {
      console.error(`❌ ${channelName}へのメッセージ投稿に失敗しました:`, result.error);
    }
  } catch (error) {
    console.error(`❌ ${channelName}へのメッセージ投稿中にエラーが発生しました:`, error);
  }
}

/**
 * チャンネル情報を取得して検証
 * @param {string} channelId - チャンネルID
 * @param {string} channelName - チャンネル名
 */
async function validateChannel(channelId, channelName) {
  if (!channelId) {
    console.log(`⚠️  ${channelName}のチャンネルIDが設定されていません`);
    return false;
  }

  try {
    const channelInfo = await client.conversations.info({ channel: channelId });
    if (!channelInfo.ok) {
      console.error(`❌ ${channelName}のチャンネル情報の取得に失敗しました:`, channelInfo.error);
      return false;
    }
    
    console.log(`📢 ${channelName}: #${channelInfo.channel.name}`);
    return true;
  } catch (error) {
    console.error(`❌ ${channelName}のチャンネル検証中にエラーが発生しました:`, error);
    return false;
  }
}

/**
 * メイン処理
 */
async function main() {
  console.log('🚀 リュークル運営チームリマインドを開始します...');
  
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
  
  // リマインド対象日かどうかを判定
  if (!isReminderDay()) {
    console.log('📅 今日はリマインド対象日ではありません');
    return;
  }
  
  // メッセージパターンを判定
  const pattern = getMessagePattern();
  console.log(`📝 メッセージパターン: ${pattern} (${pattern === 'A' ? '準備・進捗確認' : '最終追い込み確認'})`);
  
  // メッセージを生成
  let message;
  if (pattern === 'A') {
    message = generatePatternAMessage();
  } else {
    message = generatePatternBMessage();
  }
  
  console.log('📝 リマインドメッセージを生成しました');
  
  // 各チャンネルに投稿
  const channelNames = {
    chatgpt: 'ChatGPT運営チーム',
    claude: 'Claude運営チーム',
    gemini: 'Gemini運営チーム',
    genspark_manus: 'Genspark Manus運営チーム',
    n8n_dify_zapier: 'n8n-dify-zapier運営チーム',
    suno: 'Suno運営チーム',
    image_ai: '画像生成AI運営チーム'
  };
  
  for (const [key, channelId] of Object.entries(TEAM_CHANNELS)) {
    const channelName = channelNames[key];
    
    // チャンネル検証
    const isValidChannel = await validateChannel(channelId, channelName);
    if (isValidChannel) {
      // Slackに投稿
      await postReminderMessage(channelId, message, channelName);
    }
    
    // チャンネル間で少し間隔を空ける
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('✅ リュークル運営チームリマインドが完了しました');
}

// エラーハンドリング
main().catch((error) => {
  console.error('❌ 予期しないエラーが発生しました:', error);
  process.exit(1);
});
