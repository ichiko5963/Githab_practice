import { WebClient } from '@slack/web-api';
import { format } from 'date-fns';

// 設定
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_CHANNEL_ID = process.env.SLACK_CHANNEL_ID;
const TZ = 'Asia/Tokyo';

// デバッグ情報を出力
console.log('=== AI News Bot 開始 ===');
console.log('環境変数チェック:');
console.log('- SLACK_BOT_TOKEN:', SLACK_BOT_TOKEN ? '✓ 設定済み' : '✗ 未設定');
console.log('- SLACK_CHANNEL_ID:', SLACK_CHANNEL_ID || '✗ 未設定');
console.log('- TZ:', TZ);

// 必須環境変数のチェック
if (!SLACK_BOT_TOKEN) {
  console.error('❌ SLACK_BOT_TOKEN が設定されていません');
  process.exit(1);
}

if (!SLACK_CHANNEL_ID) {
  console.error('❌ SLACK_CHANNEL_ID が設定されていません');
  process.exit(1);
}

// Slackクライアント初期化
const slack = new WebClient(SLACK_BOT_TOKEN);

// AI関連のキーワード
const AI_KEYWORDS = [
  'AI', 'artificial intelligence', 'machine learning', 'deep learning',
  'GPT', 'ChatGPT', 'Claude', 'Gemini', 'OpenAI', 'Anthropic', 'Google AI',
  'neural network', 'LLM', 'large language model', 'generative AI',
  'computer vision', 'NLP', 'natural language processing',
  'robotics', 'automation', 'AI tool', 'AI update', 'AI feature'
];

// ニュースソース（信頼できるRSSフィード）
const NEWS_SOURCES = [
  {
    name: 'TechCrunch AI',
    url: 'https://techcrunch.com/category/artificial-intelligence/feed/'
  },
  {
    name: 'The Verge',
    url: 'https://www.theverge.com/rss/index.xml'
  },
  {
    name: 'MIT Technology Review AI',
    url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed/'
  },
  {
    name: 'Ars Technica',
    url: 'https://feeds.arstechnica.com/arstechnica/index/'
  }
];

// RSSフィードからニュースを取得
async function fetchNewsFromRSS(url, sourceName) {
  try {
    console.log(`📡 ${sourceName} からニュース取得中...`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const xml = await response.text();
    console.log(`✓ ${sourceName}: ${xml.length}文字取得`);
    
    // 簡単なXMLパース
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    
    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[1];
      
      // タイトル取得
      const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
      const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);
      const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);
      const descriptionMatch = itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/);
      
      if (titleMatch && linkMatch) {
        const title = (titleMatch[1] || titleMatch[2] || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
        const link = linkMatch[1].trim();
        const pubDate = pubDateMatch ? new Date(pubDateMatch[1]) : new Date();
        const description = (descriptionMatch ? (descriptionMatch[1] || descriptionMatch[2]) : '').replace(/<[^>]*>/g, '').substring(0, 150);
        
        items.push({
          title,
          link,
          pubDate,
          description,
          source: sourceName
        });
      }
    }
    
    console.log(`✓ ${sourceName}: ${items.length}件の記事を取得`);
    return items;
  } catch (error) {
    console.error(`❌ ${sourceName} の取得に失敗:`, error.message);
    return [];
  }
}

// AI関連かどうかを判定
function isAIRelated(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  return AI_KEYWORDS.some(keyword => text.includes(keyword.toLowerCase()));
}

// 過去24時間のニュースをフィルタリング
function filterRecentNews(newsItems) {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  return newsItems.filter(item => {
    const pubDate = new Date(item.pubDate);
    return pubDate >= yesterday;
  });
}

// ニュースを関連性でスコアリング
function scoreNews(newsItem) {
  let score = 0;
  const text = `${newsItem.title} ${newsItem.description}`.toLowerCase();
  
  // 重要なキーワードに高いスコア
  const importantKeywords = ['openai', 'chatgpt', 'claude', 'gemini', 'update', 'release', 'new feature', 'breakthrough'];
  importantKeywords.forEach(keyword => {
    if (text.includes(keyword)) score += 10;
  });
  
  // 一般的なAIキーワード
  AI_KEYWORDS.forEach(keyword => {
    if (text.includes(keyword.toLowerCase())) score += 2;
  });
  
  return score;
}

// メイン処理
async function main() {
  try {
    console.log('🚀 AIニュース収集開始...');
    
    // 全ソースからニュースを取得
    const allNews = [];
    for (const source of NEWS_SOURCES) {
      const news = await fetchNewsFromRSS(source.url, source.name);
      allNews.push(...news);
    }
    
    console.log(`📊 合計 ${allNews.length} 件のニュースを取得`);
    
    // AI関連のニュースをフィルタリング
    const aiNews = allNews.filter(item => isAIRelated(item.title, item.description));
    console.log(`🤖 AI関連ニュース: ${aiNews.length} 件`);
    
    // 過去24時間のニュースをフィルタリング
    const recentNews = filterRecentNews(aiNews);
    console.log(`⏰ 過去24時間のAIニュース: ${recentNews.length} 件`);
    
    // スコアリングしてソート
    const scoredNews = recentNews.map(item => ({
      ...item,
      score: scoreNews(item)
    })).sort((a, b) => b.score - a.score);
    
    // トップ3を選択
    const topNews = scoredNews.slice(0, 3);
    console.log(`📈 トップ3のニュースを選択`);
    
    // Slackに送信
    await sendToSlack(topNews);
    
    console.log('✅ AIニュース収集・送信完了');
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    
    // エラー時もSlackに通知
    try {
      await slack.chat.postMessage({
        channel: SLACK_CHANNEL_ID,
        text: `⚠️ AIニュースボットでエラーが発生しました\n\`\`\`${error.message}\`\`\``
      });
    } catch (slackError) {
      console.error('❌ Slackエラー通知も失敗:', slackError.message);
    }
    
    process.exit(1);
  }
}

// Slackにメッセージを送信
async function sendToSlack(newsItems) {
  console.log(`📤 Slackに送信中... (チャンネル: ${SLACK_CHANNEL_ID})`);
  
  if (newsItems.length === 0) {
    const message = {
      channel: SLACK_CHANNEL_ID,
      text: "🤖 AIニュースまとめ",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*🤖 ${format(new Date(), 'yyyy年MM月dd日')} AIニュースまとめ*\n\n過去24時間で特に注目すべきAI関連のニュースはありませんでした。`
          }
        }
      ]
    };
    
    const result = await slack.chat.postMessage(message);
    console.log('✓ メッセージ送信完了 (ニュースなし)');
    return;
  }
  
  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `🤖 ${format(new Date(), 'yyyy年MM月dd日')} AIニュースまとめ`
      }
    },
    {
      type: "divider"
    }
  ];
  
  newsItems.forEach((news, index) => {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${index + 1}. ${news.title}*\n${news.description}\n<${news.link}|記事を読む> | 📰 ${news.source}`
      }
    });
    
    if (index < newsItems.length - 1) {
      blocks.push({
        type: "divider"
      });
    }
  });
  
  const message = {
    channel: SLACK_CHANNEL_ID,
    text: `AIニュースまとめ - ${format(new Date(), 'yyyy年MM月dd日')}`,
    blocks: blocks
  };
  
  const result = await slack.chat.postMessage(message);
  console.log('✓ メッセージ送信完了');
  console.log(`📊 送信したニュース数: ${newsItems.length}件`);
}

// スクリプト実行
main();