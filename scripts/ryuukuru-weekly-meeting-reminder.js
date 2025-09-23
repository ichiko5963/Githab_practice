import { WebClient } from '@slack/web-api';

// Env vars
const slackToken = process.env.SLACK_BOT_TOKEN;
const channelId = 'C09BNPB16KW'; // #aircle-週例mtg

if (!slackToken) {
  console.log('⚠️  SLACK_BOT_TOKENが設定されていません。テストモードで実行します。');
  console.log('📝 生成されるメッセージ:');
  console.log('='.repeat(50));
}

// Slackクライアントの初期化
const slack = new WebClient(slackToken);

/**
 * リュークルキャラクターの週例ミーティングリマインドメッセージを送信
 */
async function sendWeeklyMeetingReminder() {
  try {
    console.log('リュークル週例ミーティングリマインドを送信中...');

    const message = `@channel

リュウクル参上！！🐲🔥

今週の定例どうだった？みんなちゃんと参加できたか？
もし参加できなかったやつは、議事録を必ず見ろよ！

議事録はいちおかが投稿してるはずだ。
このチャンネルに上がってるから確認しろ！
もしまだ投稿されてなかったら、いちおかにリマインドして必ず送らせろ！

そして大事なのはこれだ👇
議事録を見たら必ずリアクションをつけろ！👀
「見た証拠」が残らないと意味がないからな！

リュークル応援してるぞ！`;

    // トークンが設定されていない場合はテストモード
    if (!slackToken) {
      console.log(message);
      console.log('='.repeat(50));
      console.log('✅ テストモード: メッセージが正常に生成されました');
      console.log(`📅 生成時刻: ${new Date().toLocaleString('ja-JP')}`);
      console.log(`📢 対象チャンネル: ${channelId}`);
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
      console.log('✅ リュークル週例ミーティングリマインドを送信しました');
      console.log(`📅 送信時刻: ${new Date().toLocaleString('ja-JP')}`);
    } else {
      console.error('❌ メッセージ送信に失敗しました:', result.error);
    }

  } catch (error) {
    console.error('❌ エラーが発生しました:', error.message);
  }
}

// スクリプトが直接実行された場合
if (import.meta.url === `file://${process.argv[1]}`) {
  sendWeeklyMeetingReminder();
}

export { sendWeeklyMeetingReminder };
