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
 * りゅうクル口調のリマインドメッセージを送信
 */
async function sendChatReminder() {
  try {
    console.log('りゅうクル雑談リマインドを送信中...');

    const message = `@channel

リュウクル参上！！🐲🔥

おいおい、みんな！今日はまだ何も投稿してないじゃないか！
「#3-雑談_質問部屋」はみんなの交流の場なんだぞ！

何か一言でも投稿してみろよ！
- 今日の天気の話
- お昼ご飯の話  
- ちょっとした質問
- なんでもいいから一言！

みんなの声を聞きたいんだ！リュークルが寂しがってるぞ〜😢

投稿待ってるからな！`;

    // トークンが設定されていない場合はテストモード
    if (!slackToken) {
      console.log(message);
      console.log('='.repeat(50));
      console.log('✅ テストモード: メッセージが正常に生成されました');
      console.log(`📅 生成時刻: ${new Date().toLocaleString('ja-JP')}`);
      console.log(`📢 対象チャンネル: ${channelId || 'SLACK_ZATSUDAN_CHANNEL_ID未設定'}`);
      return;
    }

    const result = await slack.chat.postMessage({
      channel: channelId,
      text: message,
      link_names: true,
      username: 'リュークル',
      icon_emoji: ':dragon:'
    });

    if (result.ok) {
      console.log('✅ りゅうクル雑談リマインドを送信しました');
      console.log(`📅 送信時刻: ${new Date().toLocaleString('ja-JP')}`);
    } else {
      console.error('❌ メッセージ送信に失敗しました:', result.error);
    }

  } catch (error) {
    console.error('❌ エラーが発生しました:', error.message);
    throw error;
  }
}

/**
 * 経営部への報告メッセージを送信
 */
async function sendReportToKeiei() {
  try {
    console.log('経営部への報告メッセージを送信中...');

    const reportMessage = `📊 雑談チャンネル活動レポート

本日（${new Date().toLocaleDateString('ja-JP')}）の「#3-雑談_質問部屋」の活動状況：

❌ **投稿なし**
- 0:00以降の投稿が0件でした
- リマインドメッセージを送信済み

リュークルがみんなの投稿を待っています！🐲`;

    // トークンが設定されていない場合はテストモード
    if (!slackToken) {
      console.log('📋 経営部への報告メッセージ:');
      console.log('='.repeat(50));
      console.log(reportMessage);
      console.log('='.repeat(50));
      console.log('✅ テストモード: 報告メッセージが正常に生成されました');
      console.log(`📢 報告先チャンネル: ${reportChannelId || 'SLACK_KEIEI_CHANNEL_ID未設定'}`);
      return;
    }

    const result = await slack.chat.postMessage({
      channel: reportChannelId,
      text: reportMessage,
      username: 'リュークル',
      icon_emoji: ':dragon:'
    });

    if (result.ok) {
      console.log('✅ 経営部への報告メッセージを送信しました');
      console.log(`📅 送信時刻: ${new Date().toLocaleString('ja-JP')}`);
    } else {
      console.error('❌ 報告メッセージ送信に失敗しました:', result.error);
    }

  } catch (error) {
    console.error('❌ 報告メッセージ送信でエラーが発生しました:', error.message);
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
      await sendChatReminder();
      return;
    }
    
    console.log(`📢 対象チャンネル: ${channelId}`);
    
    // チャンネルのメッセージを取得
    const messages = await fetchChannelMessages(channelId);
    console.log(`📊 取得したメッセージ数: ${messages.length}件`);
    
    // 今日の投稿があるかチェック
    const hasTodayMessages = hasMessagesToday(messages);
    
    if (!hasTodayMessages) {
      console.log('📢 今日の投稿がないため、リマインドメッセージを送信します');
      await sendChatReminder();
      
      console.log('📋 経営部への報告メッセージを送信します');
      await sendReportToKeiei();
    } else {
      console.log('✅ 今日の投稿があるため、リマインドは送信しません');
    }
    
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
