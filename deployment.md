# 🛠️ 部署與 API 金鑰設定指南

本專案強烈建議透過 **GitHub Actions** 自動編譯並部署至 **GitHub Pages**。
由於本系統是純前端架構 (Vite SPA)，所有的環境變數必須在「編譯期」注入，因此請依照下方步驟設定您的 GitHub Secrets。

## 第一步：申請各項 API 金鑰
在部署前，您需要先去註冊以下服務的憑證：
1. **Google OAuth Client ID (必備)**：前往 [Google Cloud Console](https://console.cloud.google.com/)，開啟 `Drive API` 與 `Calendar API`，並建立 Web Client ID 憑證 (`VITE_GOOGLE_CLIENT_ID`)。這是讓您的專屬首頁具備雲端同步能力的關鍵。
2. **Google Maps API Key (建議)**：啟用 `Geocoding API`，為了將地址自動轉為精確經緯度以利地圖防呆 (`VITE_GOOGLE_MAPS_API_KEY`)。
3. **Mapbox API Key (必備)**：註冊 Mapbox 取得 Public Token，以渲染系統世界地圖 (`VITE_MAPBOX_API_KEY`)。
4. **航班查詢 API (選配)**：若想輸入航班編號自動帶入時間，可申請 [AviationStack](https://aviationstack.com/)。(**注意：這有巨大的 API 暴露風險，請見第三步解決方案**)。

## 第二步：設定 GitHub Secrets 並部署
1. 前往您的 Github 專案庫：`Settings` > `Secrets and variables` > `Actions`。
2. 點擊 **New repository secret**，將上述申請好的金鑰以 `VITE_` 開頭的名稱依序加入 (前面不需要加上 `.env`)。
3. 當您將最新程式碼 **Push 或是 Merge 至 `main` 分支** 時，便會自動觸發專案內建的 `.github/workflows` 自動編譯 `dist/` 檔案夾，並將其推至 GitHub Pages 上線。

---

## 第三步：🛡️ 航班 API 的安全性部署 (Cloudflare Workers Proxy)

**⚠️ 嚴重警告**：因為這個專案沒有後端，所有寫在 GitHub Secrets (`VITE_AVIATIONSTACK_API_KEY`) 的變數，在網頁上線後，**任何人都能透過 F12 瀏覽器開發者工具直接看到您的金鑰，進而盜刷您的 API 額度** (`Google OAuth ID` 與 `Mapbox` 屬於公開金鑰則無此風險)。

如果您想開啟航班查詢功能，**強烈建議使用免費的 [Cloudflare Workers](https://workers.cloudflare.com/) 架設 Proxy 來隱藏付費金鑰**：

**1. 建立 Worker 專案**
```bash
npm create cloudflare@latest flight-proxy
cd flight-proxy
```

**2. 撰寫通訊與跨域防護邏輯 (編輯 `src/index.js`)**
```javascript
export default {
  async fetch(request, env) {
    // 限制只能從您的 GitHub Pages 呼叫
    const allowedOrigin = "https://your_username.github.io";
    
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: { "Access-Control-Allow-Origin": allowedOrigin } });
    }

    const url = new URL(request.url);
    const flight = url.searchParams.get('flight');
    if (!flight) return new Response("Missing flight param", { status: 400 });

    // 透過隱藏在 Cloudflare 伺服器的金鑰發送真實請求
    const targetUrl = `http://api.aviationstack.com/v1/flights?access_key=${env.AVIATIONSTACK_API_KEY}&flight_iata=${flight}`;
    const response = await fetch(targetUrl);
    
    return new Response(JSON.stringify(await response.json()), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": allowedOrigin }
    });
  }
};
```

**3. 將金鑰加密推上 Cloudflare 並部署**
```bash
npx wrangler secret put AVIATIONSTACK_API_KEY
# 終端機會提示您貼上您真正的 Aviation API 金鑰

npx wrangler deploy
# 部署完成後，您會獲得一段專屬的安全網址，例如 https://flight-proxy.yourname.workers.dev
```

**4. 替換前端連線**
最後，回到本專案的原始碼 `src/services/flightService.js` 中，將原本打給 AviationStack 的區塊，改為呼叫您自己的 Worker URL 即可。這樣原本寫在 GitHub Secrets 裡危險的 `VITE_AVIATIONSTACK...` 變數就可以安全移除了！
