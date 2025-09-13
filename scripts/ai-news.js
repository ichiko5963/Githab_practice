import { WebClient } from '@slack/web-api';
import { format } from 'date-fns';

// 設定
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_CHANNEL_ID = process.env.SLACK_CHANNEL_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TZ = 'Asia/Tokyo';

// デバッグ情報を出力
console.log('=== AI News Bot 開始 ===');
console.log('環境変数チェック:');
console.log('- SLACK_BOT_TOKEN:', SLACK_BOT_TOKEN ? '✓ 設定済み' : '✗ 未設定');
console.log('- SLACK_CHANNEL_ID:', SLACK_CHANNEL_ID || '✗ 未設定');
console.log('- OPENAI_API_KEY:', OPENAI_API_KEY ? '✓ 設定済み' : '✗ 未設定');
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

// AI関連のキーワード（機能・アップデート中心）
const AI_KEYWORDS = [
  // 機能・アップデート関連
  'update', 'upgrade', 'new feature', 'release', 'launch', 'announce',
  'improvement', 'enhancement', 'new version', 'beta', 'preview',
  'アップデート', '新機能', 'リリース', 'ローンチ', '発表', '改善',
  'バージョン', 'ベータ', 'プレビュー', '機能追加',
  
  // AI技術・ツール
  'AI', 'artificial intelligence', 'machine learning', 'deep learning',
  'GPT', 'ChatGPT', 'Claude', 'Gemini', 'OpenAI', 'Anthropic',
  'neural network', 'LLM', 'large language model', 'generative AI',
  'computer vision', 'NLP', 'natural language processing',
  'robotics', 'automation', 'AI tool', 'AI feature',
  '人工知能', '機械学習', '深層学習', 'ニューラルネットワーク',
  '生成AI', '大規模言語モデル', '自然言語処理', 'コンピュータビジョン',
  'ロボティクス', '自動化', 'AIツール', 'AI機能',
  
  // 実用的なAIサービス
  'image generation', 'text generation', 'voice synthesis', 'translation',
  'recommendation', 'prediction', 'analysis', 'optimization',
  '画像生成', 'テキスト生成', '音声合成', '翻訳', '推薦', '予測', '分析'
];

// リュウクルがAIニュースを紹介する関数
async function createRyuukuruNews(newsItems) {
  if (!newsItems || newsItems.length === 0) {
    return `リュウクル参上！！🐲🔥\n今日は残念ながらAIニュースがなかったぞ...\nオイラ、明日も7時にちゃんと拾ってくるから楽しみにしててくれよな🔥`;
  }
  
  // OpenAI APIキーが設定されていない場合はシンプルな形式で返す
  if (!OPENAI_API_KEY) {
    console.log('⚠️ OpenAI APIキーが未設定のため、シンプルな形式で使用');
    let message = `リュウクル参上！！🐲🔥\n今日のAIニュースを${newsItems.length}本立てで紹介するぞ！\n\n`;
    newsItems.forEach((news, index) => {
      const emoji = ['①', '②', '③'][index] || `${index + 1}.`;
      message += `${emoji} ${news.title}\n`;
    });
    message += `\n以上、リュウクルのAIニュース速報でした！\nオイラ、明日も7時にちゃんと拾ってくるから楽しみにしててくれよな🔥`;
    return message;
  }
  
  try {
    console.log(`🤖 リュウクルがAIニュースを紹介中...`);
    
    // ニュース情報を整理
    const newsData = newsItems.slice(0, 3).map(news => ({
      title: news.title.replace(/<[^>]*>/g, '').replace(/&#8217;/g, "'").replace(/&#8216;/g, "'").replace(/&amp;/g, '&').trim(),
      description: news.description.replace(/<[^>]*>/g, '').replace(/&#8217;/g, "'").replace(/&#8216;/g, "'").replace(/&amp;/g, '&').trim()
    }));
    
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
キャラクター設定：お調子者でユーモアたっぷり、元気でフレンドリーな小さなドラゴン。
口癖：「参上！」「オイラ」「だぞ🔥」などを使って親しみやすい雰囲気を出す。
役割：AIニュースを3つ紹介し、それぞれ「なぜ注目すべきニュースなのか」を簡潔に説明する。

【出力フォーマット】
「リュウクル参上！！🐲🔥
今日のAIニュースを3本立てで紹介するぞ！

① [ニュース1のタイトル]
👉 これは[理由：なぜ注目すべきか]だから超アツいんだ！

② [ニュース2のタイトル]
👉 これは[理由]だから見逃せないぞ！

③ [ニュース3のタイトル]
👉 これは[理由]だから要チェックなんだ！

以上、リュウクルのAIニュース速報でした！
オイラ、明日も7時にちゃんと拾ってくるから楽しみにしててくれよな🔥」

条件：
- 毎回同じテンション・口調（お調子者＆ユーモア系）で出力すること。
- ニュースは3つに限定すること。
- 各ニュースの「注目ポイント」を1行でわかりやすく説明すること。
- 難しい言葉は避けて、誰でも理解できる言葉で言う。`
          },
          {
            role: 'user',
            content: `以下のAIニュースをリュウクルとして紹介してください：\n\n${newsData.map((news, index) => `${index + 1}. ${news.title}\n   ${news.description}`).join('\n\n')}`
          }
        ],
        max_tokens: 800,
        temperature: 0.7
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    const ryuukuruMessage = data.choices[0].message.content.trim();
    
    console.log(`✓ リュウクルメッセージ作成完了`);
    return ryuukuruMessage;
    
  } catch (error) {
    console.error('❌ OpenAI APIエラー:', error.message);
    console.log('🔄 シンプルな形式で使用');
    
    let message = `リュウクル参上！！🐲🔥\n今日のAIニュースを${newsItems.length}本立てで紹介するぞ！\n\n`;
    newsItems.slice(0, 3).forEach((news, index) => {
      const emoji = ['①', '②', '③'][index] || `${index + 1}.`;
      message += `${emoji} ${news.title}\n`;
    });
    message += `\n以上、リュウクルのAIニュース速報でした！\nオイラ、明日も7時にちゃんと拾ってくるから楽しみにしててくれよな🔥`;
    return message;
  }
}



// ニュースソース（日本のAIニュース中心）
const NEWS_SOURCES = [
  // 日本のAIニュース
  {
    name: 'ITmedia AI',
    url: 'https://rss.itmedia.co.jp/rss/2.0/ait.xml'
  },
  {
    name: 'Impress Watch AI',
    url: 'https://www.watch.impress.co.jp/data/rss/1.0/ipw/feed.rdf'
  },
  {
    name: '日経テクノロジー',
    url: 'https://rss.nikkei.com/rss/nt/technology.xml'
  },
  {
    name: 'ZDNet Japan AI',
    url: 'https://japan.zdnet.com/rss/ai.xml'
  },
  // 海外の主要AIニュース（バランスのため）
  {
    name: 'TechCrunch AI',
    url: 'https://techcrunch.com/category/artificial-intelligence/feed/'
  },
  {
    name: 'MIT Technology Review AI',
    url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed/'
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

// ニュースを関連性でスコアリング（機能・アップデート重視）
function scoreNews(newsItem) {
  let score = 0;
  const text = `${newsItem.title} ${newsItem.description}`.toLowerCase();
  
  // 機能・アップデート関連に最高スコア
  const updateKeywords = ['update', 'upgrade', 'new feature', 'release', 'launch', 'improvement', 'enhancement', 'beta', 'preview', 'アップデート', '新機能', 'リリース', 'ローンチ', '改善', 'ベータ', 'プレビュー'];
  updateKeywords.forEach(keyword => {
    if (text.includes(keyword)) score += 15;
  });
  
  // 実用的なAIサービスに高スコア
  const practicalKeywords = ['image generation', 'text generation', 'voice synthesis', 'translation', 'recommendation', 'prediction', 'analysis', '画像生成', 'テキスト生成', '音声合成', '翻訳', '推薦', '予測', '分析'];
  practicalKeywords.forEach(keyword => {
    if (text.includes(keyword)) score += 12;
  });
  
  // 人気AIツールに中スコア
  const popularTools = ['chatgpt', 'claude', 'gemini', 'openai', 'anthropic'];
  popularTools.forEach(keyword => {
    if (text.includes(keyword)) score += 8;
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
  
  const today = format(new Date(), 'yyyy年MM月dd日');
  
  if (newsItems.length === 0) {
    const message = {
      channel: SLACK_CHANNEL_ID,
      text: `【${today}】のAIニュース`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*【${today}】のAIニュース*\n\n過去24時間で特に注目すべきAI関連のニュースはありませんでした。`
          }
        }
      ]
    };
    
    const result = await slack.chat.postMessage(message);
    console.log('✓ メッセージ送信完了 (ニュースなし)');
    return;
  }
  
  // リュウクルがAIニュースを紹介
  const ryuukuruMessage = await createRyuukuruNews(newsItems);
  
  // 記事リンクを追加
  let messageText = ryuukuruMessage + '\n\n';
  messageText += '📰 記事リンク:\n';
  newsItems.slice(0, 3).forEach((news, index) => {
    const emoji = ['①', '②', '③'][index] || `${index + 1}.`;
    messageText += `${emoji} <${news.link}|${news.source}>\n`;
  });
  
  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: messageText
      }
    }
  ];
  
  const message = {
    channel: SLACK_CHANNEL_ID,
    text: `リュウクルのAIニュース速報`,
    blocks: blocks
  };
  
  const result = await slack.chat.postMessage(message);
  console.log('✓ リュウクルメッセージ送信完了');
  console.log(`📊 送信したニュース数: ${newsItems.length}件`);
  console.log('🐲 リュウクルキャラクターで紹介済み');
}

// スクリプト実行
main();