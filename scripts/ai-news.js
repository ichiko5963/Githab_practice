import { WebClient } from '@slack/web-api';
import { format, subDays, subHours } from 'date-fns';

const client = new WebClient(process.env.SLACK_BOT_TOKEN);
const CHANNEL_ID = process.env.SLACK_CHANNEL_ID || '#aiニュース';
const TZ = 'Asia/Tokyo';

// AI関連のキーワード
const AI_KEYWORDS = [
  'AI', 'artificial intelligence', 'machine learning', 'deep learning',
  'GPT', 'ChatGPT', 'Claude', 'Gemini', 'OpenAI', 'Anthropic', 'Google AI',
  'neural network', 'LLM', 'large language model', 'generative AI',
  'computer vision', 'NLP', 'natural language processing',
  'robotics', 'automation', 'AI tool', 'AI update', 'AI feature'
];

// RSSフィードとAPIのソース
const NEWS_SOURCES = [
  {
    name: 'TechCrunch AI',
    url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
    type: 'rss'
  },
  {
    name: 'The Verge AI',
    url: 'https://www.theverge.com/ai-artificial-intelligence/rss/index.xml',
    type: 'rss'
  },
  {
    name: 'MIT Technology Review AI',
    url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed/',
    type: 'rss'
  },
  {
    name: 'Ars Technica AI',
    url: 'https://feeds.arstechnica.com/arstechnica/index/',
    type: 'rss'
  },
  {
    name: 'VentureBeat AI',
    url: 'https://venturebeat.com/ai/feed/',
    type: 'rss'
  }
];

// RSSフィードをパースする関数
async function parseRSS(url) {
  try {
    const response = await fetch(url);
    const xml = await response.text();
    
    // 簡単なXMLパース（実際のプロダクションではxml2jsなどのライブラリを使用推奨）
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    
    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[1];
      const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
      const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);
      const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);
      const descriptionMatch = itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/);
      
      if (titleMatch && linkMatch) {
        const title = titleMatch[1] || titleMatch[2];
        const link = linkMatch[1];
        const pubDate = pubDateMatch ? new Date(pubDateMatch[1]) : new Date();
        const description = descriptionMatch ? (descriptionMatch[1] || descriptionMatch[2]) : '';
        
        items.push({
          title: title.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'),
          link: link.trim(),
          pubDate,
          description: description.replace(/<[^>]*>/g, '').substring(0, 200)
        });
      }
    }
    
    return items;
  } catch (error) {
    console.error(`Error parsing RSS feed ${url}:`, error);
    return [];
  }
}

// ニュースがAI関連かどうかを判定
function isAIRelated(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  return AI_KEYWORDS.some(keyword => text.includes(keyword.toLowerCase()));
}

// 時間範囲内のニュースをフィルタリング
function filterNewsByTime(newsItems, hoursBack = 24) {
  const now = new Date();
  const cutoffTime = new Date(now.getTime() - (hoursBack * 60 * 60 * 1000));
  
  return newsItems.filter(item => {
    const pubDate = new Date(item.pubDate);
    return pubDate >= cutoffTime;
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
  
  // タイトルに含まれる場合はボーナス
  if (newsItem.title.toLowerCase().includes('ai')) score += 5;
  
  return score;
}

// ニュースを取得するメイン関数
async function fetchAINews() {
  console.log('Fetching AI news...');
  
  const allNews = [];
  
  // RSSフィードからニュースを取得
  for (const source of NEWS_SOURCES) {
    if (source.type === 'rss') {
      console.log(`Fetching from ${source.name}...`);
      const items = await parseRSS(source.url);
      
      items.forEach(item => {
        if (isAIRelated(item.title, item.description)) {
          allNews.push({
            ...item,
            source: source.name,
            score: scoreNews(item)
          });
        }
      });
    }
  }
  
  // 時間範囲でフィルタリング（過去24時間）
  const recentNews = filterNewsByTime(allNews, 24);
  
  // スコア順でソート
  recentNews.sort((a, b) => b.score - a.score);
  
  // トップ3を返す
  return recentNews.slice(0, 3);
}

// Slackにメッセージを送信
async function sendToSlack(newsItems) {
  if (newsItems.length === 0) {
    const message = {
      channel: CHANNEL_ID,
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
    
    await client.chat.postMessage(message);
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
    channel: CHANNEL_ID,
    text: `AIニュースまとめ - ${format(new Date(), 'yyyy年MM月dd日')}`,
    blocks: blocks
  };
  
  try {
    await client.chat.postMessage(message);
    console.log('Successfully sent AI news to Slack');
  } catch (error) {
    console.error('Error sending message to Slack:', error);
  }
}

// メイン実行関数
async function main() {
  try {
    console.log('Starting AI news collection...');
    const newsItems = await fetchAINews();
    console.log(`Found ${newsItems.length} relevant AI news items`);
    
    await sendToSlack(newsItems);
    console.log('AI news delivery completed');
  } catch (error) {
    console.error('Error in main execution:', error);
    
    // エラー時にもSlackに通知
    try {
      await client.chat.postMessage({
        channel: CHANNEL_ID,
        text: `⚠️ AIニュース取得でエラーが発生しました: ${error.message}`
      });
    } catch (slackError) {
      console.error('Error sending error message to Slack:', slackError);
    }
  }
}

// スクリプトが直接実行された場合のみmainを実行
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main, fetchAINews, sendToSlack };
