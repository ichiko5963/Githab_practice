import { WebClient } from '@slack/web-api';

// 設定
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const TARGET_CHANNEL = process.env.TARGET_CHANNEL || '1-運営からの連絡';

// デバッグ情報を出力
console.log('=== Slackチャンネル紹介ボット 開始 ===');
console.log('環境変数チェック:');
console.log('- SLACK_BOT_TOKEN:', SLACK_BOT_TOKEN ? '✓ 設定済み' : '✗ 未設定');
console.log('- TARGET_CHANNEL:', TARGET_CHANNEL);

// 必須環境変数のチェック（テストモードではスキップ）
const args = process.argv.slice(2);
const isTestMode = args.includes('--test');

if (!SLACK_BOT_TOKEN && !isTestMode) {
  console.error('❌ SLACK_BOT_TOKEN が設定されていません');
  process.exit(1);
}

// Slackクライアント初期化
const slack = new WebClient(SLACK_BOT_TOKEN);

// チャンネル紹介メッセージ
const CHANNEL_INTRO_MESSAGE = `【チャンネルのご紹介】 @channel

リュウクル参上！
No.7以降のチャンネルには、こんなに面白い部屋が揃ってるぞ。
	•	#81_chatgpt
	•	#82_gemini-notebooklm
	•	#83_claude
	•	#84_manus-genspark
	•	#85_suno-udio-veo3-midjourney-sora
	•	#86_n8n-dify-zapier
	•	#88_veo3-midjourney-sora
	•	#91_tkくんのobsidian部屋
	•	#92_いちのai-agent作ろう部屋

AIからツール活用、ノート術まで盛りだくさんだな！
「チャンネルを追加する ＞ チャンネル一覧 ＞ 参加する」で入れるから、気になるところに飛び込んでみてくれよな。

オイラは毎日見張ってるから、みんなの参加を楽しみにしてるぜ！`;

/**
 * チャンネルIDまたはチャンネル名をそのまま使用
 */
function getChannelIdentifier(channelIdentifier) {
  // チャンネルID（Cで始まる）の場合はそのまま使用
  if (channelIdentifier.startsWith('C') || channelIdentifier.startsWith('G')) {
    console.log(`📍 チャンネルIDを直接使用: ${channelIdentifier}`);
    return channelIdentifier;
  }
  
  // チャンネル名の場合は#を付けて使用
  const channelName = channelIdentifier.startsWith('#') ? channelIdentifier : `#${channelIdentifier}`;
  console.log(`📍 チャンネル名を使用: ${channelName}`);
  return channelName;
}

/**
 * チャンネル紹介メッセージを送信
 */
async function sendChannelIntroMessage() {
  try {
    console.log('📢 チャンネル紹介メッセージを送信中...');
    
    // チャンネル識別子を取得（IDまたは名前）
    const channelIdentifier = getChannelIdentifier(TARGET_CHANNEL);
    
    // メッセージを送信
    const result = await slack.chat.postMessage({
      channel: channelIdentifier,
      text: CHANNEL_INTRO_MESSAGE
    });
    
    console.log(`✅ チャンネル紹介メッセージ送信完了`);
    console.log(`📝 メッセージID: ${result.ts}`);
    console.log(`📍 送信先: ${channelIdentifier}`);
    
    return true;
    
  } catch (error) {
    console.error(`❌ メッセージ送信エラー:`, error.message);
    if (error.message.includes('missing_scope')) {
      console.log(`💡 必要なスコープ: chat:write, channels:write, groups:write`);
    }
    if (error.message.includes('channel_not_found')) {
      console.log(`💡 チャンネルが見つかりません。チャンネルIDまたは名前を確認してください`);
    }
    if (error.message.includes('not_in_channel')) {
      console.log(`💡 ボットがチャンネルに参加していません。チャンネルに招待してください`);
    }
    return false;
  }
}

/**
 * テストモード実行
 */
async function testMode() {
  console.log('🧪 テストモード実行');
  console.log('送信予定のメッセージ:');
  console.log('---');
  console.log(CHANNEL_INTRO_MESSAGE);
  console.log('---');
  console.log(`送信先チャンネル: ${TARGET_CHANNEL}`);
}

// メイン実行
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--test')) {
    await testMode();
    return;
  }
  
  // 通常実行
  const success = await sendChannelIntroMessage();
  
  if (success) {
    console.log('🎉 チャンネル紹介メッセージ送信完了');
  } else {
    console.error('❌ チャンネル紹介メッセージ送信失敗');
    process.exit(1);
  }
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
