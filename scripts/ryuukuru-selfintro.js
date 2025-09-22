import { WebClient } from '@slack/web-api';
import { format, subDays, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';

// 設定
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_SELFINTRO_CHANNEL_ID = process.env.SLACK_SELFINTRO_CHANNEL_ID || '#2-自己紹介';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TZ = 'Asia/Tokyo';

// デバッグ情報を出力
console.log('=== リュークル自己紹介定期報告ボット 開始 ===');
console.log('環境変数チェック:');
console.log('- SLACK_BOT_TOKEN:', SLACK_BOT_TOKEN ? '✓ 設定済み' : '✗ 未設定');
console.log('- SLACK_SELFINTRO_CHANNEL_ID:', SLACK_SELFINTRO_CHANNEL_ID);
console.log('- OPENAI_API_KEY:', OPENAI_API_KEY ? '✓ 設定済み' : '✗ 未設定');
console.log('- TZ:', TZ);

// 必須環境変数のチェック
if (!SLACK_BOT_TOKEN) {
  console.error('❌ SLACK_BOT_TOKEN が設定されていません');
  process.exit(1);
}

// Slackクライアント初期化
const slack = new WebClient(SLACK_BOT_TOKEN);

/**
 * チャンネルIDを取得
 */
async function getChannelId(channelIdentifier) {
  try {
    console.log(`📊 チャンネルIDを取得中: ${channelIdentifier}`);
    
    // チャンネルID（Cで始まる）の場合はそのまま使用
    if (channelIdentifier.startsWith('C') || channelIdentifier.startsWith('G')) {
      console.log(`📍 チャンネルIDを直接使用: ${channelIdentifier}`);
      return channelIdentifier;
    }
    
    // チャンネル名の場合は#を付けて検索
    const channelName = channelIdentifier.startsWith('#') ? channelIdentifier.slice(1) : channelIdentifier;
    
    const channelList = await slack.conversations.list({
      types: 'public_channel,private_channel',
      exclude_archived: true,
      limit: 1000
    });
    
    const channel = channelList.channels.find(ch => ch.name === channelName);
    if (channel) {
      console.log(`✅ チャンネルID取得: ${channelName} -> ${channel.id}`);
      return channel.id;
    } else {
      console.error(`❌ チャンネルが見つかりません: ${channelName}`);
      return null;
    }
    
  } catch (error) {
    console.error('❌ チャンネルID取得エラー:', error.message);
    return null;
  }
}

/**
 * 指定期間のメッセージを取得
 */
async function getMessagesInPeriod(channelId, startDate, endDate) {
  try {
    console.log(`📅 メッセージ取得中: ${format(startDate, 'yyyy-MM-dd')} 〜 ${format(endDate, 'yyyy-MM-dd')}`);
    
    const messages = [];
    let cursor = null;
    let hasMore = true;
    
    while (hasMore) {
      const result = await slack.conversations.history({
        channel: channelId,
        oldest: Math.floor(startDate.getTime() / 1000),
        latest: Math.floor(endDate.getTime() / 1000),
        cursor: cursor,
        limit: 200
      });
      
      messages.push(...result.messages);
      hasMore = result.has_more;
      cursor = result.response_metadata?.next_cursor;
      
      console.log(`📊 取得済みメッセージ数: ${messages.length}`);
    }
    
    // ユーザー情報を取得
    const userIds = [...new Set(messages.map(msg => msg.user).filter(Boolean))];
    const userMap = {};
    
    for (const userId of userIds) {
      try {
        const user = await slack.users.info({ user: userId });
        userMap[userId] = user.user;
      } catch (error) {
        console.warn(`⚠️ ユーザー情報取得失敗: ${userId}`, error.message);
      }
    }
    
    // メッセージにユーザー情報を追加
    const messagesWithUsers = messages.map(msg => ({
      ...msg,
      userInfo: userMap[msg.user] || { real_name: 'Unknown User', display_name: 'Unknown User' }
    }));
    
    console.log(`✅ ${messagesWithUsers.length}件のメッセージを取得`);
    return messagesWithUsers;
    
  } catch (error) {
    console.error('❌ メッセージ取得エラー:', error.message);
    return [];
  }
}

/**
 * OpenAI APIを使って自己紹介を要約・コメント生成
 */
async function generateRyuukuruComment(introText, userName) {
  if (!OPENAI_API_KEY) {
    console.log('⚠️ OpenAI APIキーが未設定のため、シンプルな形式で使用');
    return {
      summary: introText.substring(0, 50) + '...',
      comment: 'AI大好きな仲間だな！オイラも共感するぞ！'
    };
  }
  
  try {
    console.log(`🤖 リュークルが自己紹介を分析中: ${userName}`);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `あなたはAirCleの公式マスコット「リュウクル」です。

キャラクター設定：
- 名前: リュウクル
- 性格: お調子者＆ユーモラス、仲間思いでAI大好き
- 好きなもの: AI（ChatGPT, Claude, Gemini, Midjourney, n8nなど）
- 一人称: オイラ
- 口調: 親しみやすく、元気でフレンドリー

役割: 自己紹介を読み取って、短く要約し、リュウクルらしいユーモラスなコメントを付ける

【出力フォーマット】
以下のJSON形式で出力してください：
{
  "summary": "自己紹介の要約（30文字以内）",
  "comment": "リュウクルらしいユーモラスなコメント（50文字以内）"
}

【コメントの例】
- AI関連の話題: "AI大好きな仲間だな！オイラも共感するぞ！"
- 趣味の話題: "いい趣味だな！オイラも興味深いぞ！"
- 仕事の話題: "頼もしいな！オイラも応援するぞ！"
- 学習の話題: "勉強熱心でカッコいいな！オイラも見習うぞ！"

条件：
- 必ずJSON形式で出力すること
- 要約は30文字以内、コメントは50文字以内
- リュウクルのキャラクターに合わせた親しみやすい口調
- AI関連の話題には特に反応すること`
          },
          {
            role: 'user',
            content: `以下の自己紹介を分析してください：\n\n${introText}`
          }
        ],
        max_tokens: 200,
        temperature: 0.7
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content.trim());
    
    console.log(`✓ リュウクルコメント生成完了: ${userName}`);
    return result;
    
  } catch (error) {
    console.error('❌ OpenAI APIエラー:', error.message);
    console.log('🔄 フォールバック形式で使用');
    
    return {
      summary: introText.substring(0, 50) + '...',
      comment: 'AI大好きな仲間だな！オイラも共感するぞ！'
    };
  }
}

/**
 * リュウクルの自己紹介報告メッセージを生成
 */
async function createRyuukuruReport(introMessages, startDate, endDate) {
  const startDateStr = format(startDate, 'M月d日', { locale: ja });
  const endDateStr = format(endDate, 'M月d日', { locale: ja });
  
  let message = `リュウクル参上！！ 🐲🔥\nこの4日間（${startDateStr}〜${endDateStr}）の自己紹介をチェックしたぞ！\n\n`;
  
  if (introMessages.length === 0) {
    message += `悲しいことに、この期間は自己紹介してくれる仲間はいなかった…。\nでも自己紹介すれば、趣味や興味が合う仲間とつながれるんだ。\n次こそ名乗りを上げてくれよな！\n\n`;
  } else {
    message += `新しい仲間が自己紹介してくれたんだ！\n\n`;
    
    // 各自己紹介を処理
    for (const msg of introMessages) {
      const userName = msg.userInfo.real_name || msg.userInfo.display_name || 'Unknown User';
      const introText = msg.text || '';
      
      // AIで要約・コメント生成
      const analysis = await generateRyuukuruComment(introText, userName);
      
      message += `- ${userName}さん：${analysis.summary} → ${analysis.comment}\n`;
    }
    
    message += `\nみんなも趣味や気になることが合う子を見つけたら、スレッドで話しかけに行ってみてくれよな！\n\n`;
  }
  
  // 自己紹介リンク案内
  message += `自己紹介のやり方はここにまとめてあるぞ👇\nhttps://aircle.slack.com/docs/T09B8K99ML3/F09BDMKKYV8\n\n`;
  
  // 締め
  message += `オイラは定期的に自己紹介をまとめてくるから、また楽しみにしててくれよな！`;
  
  return message;
}

/**
 * Slackにメッセージを送信
 */
async function sendToSlack(message) {
  try {
    console.log(`📤 Slackに送信中... (チャンネル: ${SLACK_SELFINTRO_CHANNEL_ID})`);
    
    const result = await slack.chat.postMessage({
      channel: SLACK_SELFINTRO_CHANNEL_ID,
      text: message
    });
    
    console.log('✓ リュウクルメッセージ送信完了');
    console.log(`📝 メッセージID: ${result.ts}`);
    return true;
    
  } catch (error) {
    console.error('❌ Slack送信エラー:', error.message);
    if (error.message.includes('missing_scope')) {
      console.log('💡 必要なスコープ: chat:write, channels:read, users:read');
    }
    if (error.message.includes('channel_not_found')) {
      console.log('💡 チャンネルが見つかりません。チャンネルIDまたは名前を確認してください');
    }
    if (error.message.includes('not_in_channel')) {
      console.log('💡 ボットがチャンネルに参加していません。チャンネルに招待してください');
    }
    return false;
  }
}

/**
 * メイン処理
 */
async function main() {
  try {
    console.log('🚀 リュークル自己紹介定期報告開始...');
    
    // チャンネルIDを取得
    const channelId = await getChannelId(SLACK_SELFINTRO_CHANNEL_ID);
    if (!channelId) {
      throw new Error(`チャンネルが見つかりません: ${SLACK_SELFINTRO_CHANNEL_ID}`);
    }
    
    // 対象期間を計算（前4日間）
    const now = new Date();
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const startDate = subDays(endDate, 4);
    
    console.log(`📅 対象期間: ${format(startDate, 'yyyy-MM-dd HH:mm')} 〜 ${format(endDate, 'yyyy-MM-dd HH:mm')}`);
    
    // メッセージを取得
    const messages = await getMessagesInPeriod(channelId, startDate, endDate);
    
    // 自己紹介メッセージをフィルタリング（簡単な判定）
    const introMessages = messages.filter(msg => {
      const text = (msg.text || '').toLowerCase();
      // 自己紹介らしいキーワードを含むメッセージを抽出
      const introKeywords = [
        '自己紹介', 'はじめまして', 'よろしく', '趣味', '好き', '興味',
        '仕事', '職業', '会社', '学生', '勉強', '学習', '経験',
        'ai', 'chatgpt', 'claude', 'gemini', 'midjourney', 'n8n'
      ];
      
      return introKeywords.some(keyword => text.includes(keyword)) && 
             !msg.subtype && // システムメッセージを除外
             msg.text && msg.text.length > 10; // 短すぎるメッセージを除外
    });
    
    console.log(`📊 自己紹介メッセージ: ${introMessages.length}件`);
    
    // リュウクルの報告メッセージを生成
    const reportMessage = await createRyuukuruReport(introMessages, startDate, endDate);
    
    // Slackに送信
    const success = await sendToSlack(reportMessage);
    
    if (success) {
      console.log('✅ リュークル自己紹介定期報告完了');
    } else {
      throw new Error('Slack送信に失敗しました');
    }
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    
    // エラー時もSlackに通知
    try {
      await slack.chat.postMessage({
        channel: SLACK_SELFINTRO_CHANNEL_ID,
        text: `⚠️ リュークル自己紹介定期報告でエラーが発生しました\n\`\`\`${error.message}\`\`\``
      });
    } catch (slackError) {
      console.error('❌ Slackエラー通知も失敗:', slackError.message);
    }
    
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
