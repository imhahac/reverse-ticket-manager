import { google } from 'googleapis';
import readline from 'readline';

/**
 * 🛠️ Google OAuth2 Refresh Token 獲取工具
 * ---------------------------------------
 * 使用方法：
 * 1. 確保已安裝 Node.js
 * 2. 在終端機執行: node scripts/get-refresh-token.js
 * 3. 依照提示輸入您的 Client ID 與 Client Secret
 */

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function getRefreshToken() {
    console.log('\n--- Google OAuth2 憑證助手 ---\n');
    console.log('請先前往 Google Cloud Console 確保您的 OAuth 客戶端已設定：');
    console.log('1. 重導向 URI 包含: http://localhost:3000 (或任何您想用的，此腳本暫不需要實體伺服器)');
    console.log('2. 確定已啟用 Google Drive API');
    console.log('-----------------------------\n');

    const clientId = await question('請輸入您的 Google Client ID: ');
    const clientSecret = await question('請輸入您的 Google Client Secret: ');

    const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        'urn:ietf:wg:oauth:2.0:oob' // 手動複製貼上模式
    );

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/drive.readonly'],
        prompt: 'consent' // 強制顯示同意以獲取 refresh_token
    });

    console.log('\n🚀 請在瀏覽器打開以下連結並授權：');
    console.log(authUrl);

    const code = await question('\n貼上授權碼 (Code) 並按 Enter: ');

    try {
        const { tokens } = await oauth2Client.getToken(code);
        console.log('\n✅ 成功獲取憑證！');
        console.log('----------------------------');
        console.log('GOOGLE_REFRESH_TOKEN:', tokens.refresh_token);
        console.log('----------------------------');
        console.log('\n請將此 Token 存入您的 GitHub Repo Secrets 中。');
        console.log('同時也請確保 GOOGLE_CLIENT_ID 與 GOOGLE_CLIENT_SECRET 已存入。\n');
    } catch (err) {
        console.error('❌ 獲取失敗:', err.message);
    } finally {
        rl.close();
    }
}

getRefreshToken();
