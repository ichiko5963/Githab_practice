import { WebClient } from '@slack/web-api';

// Env vars
const slackToken = process.env.SLACK_BOT_TOKEN;

if (!slackToken) {
  console.error('Missing SLACK_BOT_TOKEN');
  console.log('使用方法: SLACK_BOT_TOKEN=your_token node get_user_id.js');
  process.exit(1);
}

const client = new WebClient(slackToken);

/**
 * ユーザー名からユーザーIDを検索
 * @param {string} displayName - 表示名（例: "よしき", "りょうせい"）
 * @returns {string|null} ユーザーID
 */
async function findUserByName(displayName) {
  try {
    const result = await client.users.list();
    
    if (!result.ok) {
      console.error('❌ ユーザーリストの取得に失敗しました:', result.error);
      return null;
    }

    const users = result.members || [];
    
    // 表示名で検索
    const user = users.find(u => 
      u.profile?.display_name?.includes(displayName) ||
      u.profile?.real_name?.includes(displayName) ||
      u.name?.includes(displayName)
    );

    if (user) {
      return user.id;
    }

    return null;
  } catch (error) {
    console.error('❌ ユーザー検索中にエラーが発生しました:', error);
    return null;
  }
}

/**
 * 全ユーザーリストを表示
 */
async function listAllUsers() {
  try {
    const result = await client.users.list();
    
    if (!result.ok) {
      console.error('❌ ユーザーリストの取得に失敗しました:', result.error);
      return;
    }

    const users = result.members || [];
    
    console.log('📋 Slackワークスペースの全ユーザー:');
    console.log('=' .repeat(80));
    
    users.forEach(user => {
      if (!user.deleted && !user.is_bot) {
        const displayName = user.profile?.display_name || user.profile?.real_name || user.name || '名前なし';
        console.log(`👤 ${displayName}`);
        console.log(`   ID: ${user.id}`);
        console.log(`   メール: ${user.profile?.email || 'なし'}`);
        console.log('   ' + '-'.repeat(50));
      }
    });
    
  } catch (error) {
    console.error('❌ ユーザーリスト取得中にエラーが発生しました:', error);
  }
}

/**
 * 特定のユーザーを検索
 */
async function searchSpecificUsers() {
  const targetUsers = ['よしき', 'りょうせい'];
  
  console.log('🔍 対象ユーザーの検索結果:');
  console.log('=' .repeat(50));
  
  for (const userName of targetUsers) {
    const userId = await findUserByName(userName);
    if (userId) {
      console.log(`✅ ${userName}: ${userId}`);
    } else {
      console.log(`❌ ${userName}: 見つかりませんでした`);
    }
  }
}

/**
 * メイン処理
 */
async function main() {
  console.log('🚀 SlackユーザーID取得ツールを開始します...\n');
  
  // 特定ユーザーの検索
  await searchSpecificUsers();
  
  console.log('\n' + '=' .repeat(80));
  
  // 全ユーザーリストの表示
  await listAllUsers();
  
  console.log('\n📝 使用方法:');
  console.log('1. 上記の結果から対象ユーザーのIDをコピー');
  console.log('2. scripts/ryuukuru-x-reminder.js の MENTION_USERS を更新');
  console.log('3. 例: yoshiki: \'U0123456789\', ryosei: \'U0987654321\'');
}

// エラーハンドリング
main().catch((error) => {
  console.error('❌ 予期しないエラーが発生しました:', error);
  process.exit(1);
});
