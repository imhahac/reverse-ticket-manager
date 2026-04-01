# 🛠️ 部署與 API 金鑰設定指南

本專案強烈建議透過 **GitHub Actions** 自動編譯並部署至 **GitHub Pages**。  
由於本系統是純前端架構 (Vite SPA)，所有的環境變數必須在「編譯期」注入，因此請依照下方步驟設定您的 GitHub Secrets 與 Variables。

---

## 🔑 第一步：申請基本與必備金鑰

在部署前，您需要先去註冊以下服務的憑證：

1. **Google OAuth Client ID (必備)**  
   - 前往 [Google Cloud Console](https://console.cloud.google.com/)，建立並啟用 `Google Drive API` 與 `Google Calendar API`。
   - 建立 OAuth 2.0 Web Client ID 憑證 (`VITE_GOOGLE_CLIENT_ID`)。確保您將 **Authorized JavaScript origins** 和 **Authorized redirect URIs** 設為您的 GitHub Pages 網址。

2. **Google Maps API Key (必備)**  
   - 啟用 [Geocoding API](https://developers.google.com/maps/documentation/geocoding/overview) 與 [Maps JavaScript API](https://developers.google.com/maps/documentation/javascript/overview)。
   - 此金鑰用於渲染系統核心地圖與自動轉座標功能 (`VITE_GOOGLE_MAPS_API_KEY`)。
   - ⚠️ **安全性必要步驟**：由於此金鑰會暴露在前端，請務必執行下方 [Google Maps 憑證安全性強化](#🛡️-第四步-google-maps-api-key-安全性強化) 的設定。

3. **Mapbox API Key (選配)**  
   - 註冊 [Mapbox](https://www.mapbox.com/) 取得 Public Token。僅作為 Geocoding 的備援方案，若已有 Google Maps 則非必填 (`VITE_MAPBOX_API_KEY`)。

4. **航班查詢 API (選配，需搭配 Proxy 隱減)**  
   - 申請 [AviationStack](https://aviationstack.com/) 或 [AirLabs](https://airlabs.co/)。
   - ⚠️ **切勿**將這兩支 API 的金鑰直接寫在前端環境變數中，後續將說明如何利用 [Cloudflare Workers Proxy](#第二步-航班-api-安全性部署-cloudflare-workers-proxy) 保護它們。

---

## 🛡️ 第四步：Google Maps API Key 安全性強化 (重要)

因為本專案是純前端架構，Google Maps API Key 會在載入 JS SDK 時發送給客戶端。為了防止金鑰被盜用並耗盡您的免費額度，**您必須在 Google Cloud Console 設定來源限制**。

### 1. 設定應用程式限制 (Application Restrictions)
1. 進入 [Google Cloud Console 憑證頁面](https://console.cloud.google.com/google/maps-apis/credentials)。
2. 點擊進入您為本專案建立的 **API Key**。
3. 在 **Application restrictions** 區塊中，選擇 **Websites (HTTP referrers)**。
4. 在下方 **Website restrictions** 中點擊 **ADD**，加入您的 GitHub Pages 網域：
   - 格式範例：`https://yourname.github.io/*` (請將 yourname 換成您的帳號)。
   - 如果您有自定義網域，也請一併加入。

### 2. 設定 API 限制 (API Restrictions)
1. 在同一頁面的 **API restrictions** 區塊中，選擇 **Restrict key**。
2. 在下拉選單中**僅勾選**以下兩項：
   - `Geocoding API`
   - `Maps JavaScript API`
3. 點擊 **SAVE**。

> [!TIP]
> 這樣設定後，即便他人拿到您的 API Key，也無法在非您的網域下使用，也無法調用除了地圖與經緯度以外的其他昂貴 API。

---

## 🛡️ 第二步：航班 API 安全性部署 (Cloudflare Workers Proxy)

**嚴重警告**：本專案為無後端架構，若直接將航班查詢 API (AviationStack/AirLabs) 金鑰放進純前端專案中，網頁上線後任何人都可透過瀏覽器 (F12) 擷取您的金鑰並盜刷額度。

為解決此安全風險，我們已在專案的 `cloudflare-worker/` 提供預寫好的 Proxy 腳本 (`worker.js`)。請跟隨以下步驟，**免費**架設您的專屬 Serverless Proxy。

### 1. 準備您的環境
請開啟終端機並確保已安裝 [Node.js](https://nodejs.org/)。
```bash
# 進入專案內的 worker 目錄
cd cloudflare-worker

# 全域安裝 Cloudflare 的命令列工具 Wrangler
npm install -g wrangler
```

### 2. 加密儲存您的金鑰
請利用 Wrangler 登入，並將您申請的航班 API 金鑰安全地推上雲端：
```bash
wrangler secret put AVIATIONSTACK_API_KEY
# 終端機會提示您，請貼上剛申請的 AviationStack API 金鑰

wrangler secret put AIRLABS_API_KEY
# 終端機會提示您，請貼上剛申請的 AirLabs API 金鑰
```

### 3. 發布您的 Proxy
```bash
wrangler deploy
# 部署完成後，您會獲得一段專屬的安全網址
# 例如：https://flight-proxy.yourname.workers.dev
```

請記下這段網址，我們將在下一階段把它填入您的 GitHub Actions 設定中。

---

## 🚀 第三步：設定 GitHub 變數與部署

完成 API 申請與 Proxy 架設後，請回到您的 GitHub 專案：

路徑： `Settings` > `Secrets and variables` > `Actions`

### 1. Variables (非敏感變數)
將不涉及隱私或有嚴格網域綁定的變數，加入 **Repository variables**：
- **`VITE_GOOGLE_CLIENT_ID`**：你的 Google OAuth 登入 ID (由於已在 GCP 限定網域，相對安全)。
- **`VITE_MAPBOX_API_KEY`**：Mapbox Token。
- **`VITE_FLIGHT_PROXY_URL`**：剛剛從 Cloudflare 取得的 Proxy 網址 (例如 `https://flight-proxy.yourname.workers.dev`)。

### 2. Secrets (高敏感變數)
將絕對不能外流的變數，加入 **Repository secrets**：
- **`VITE_GOOGLE_MAPS_API_KEY`**：雖然 GCP 也可以設定網域白名單限制呼叫，但放入 secrets 可降低誤用的風險。
- **(提醒)** 請**不要**將 `VITE_AVIATIONSTACK_API_KEY` 放入這裡，因為它們已經被放入前端不會接觸到的 Cloudflare Worker 中了！

### 3. 自動化部署 (CI/CD)
本專案已設定好 Actions 工作流程。您只需要：
1. 確保上述 1、2 步驟已設定完成。
2. 將任何變更（包含一開始的 Fork 或是新的 Commit） **Push 或 Merge 至 `main` 分支**。
3. 系統將自動執行編譯，並將編譯後的 `dist/` 部署到您的 GitHub Pages 上。

---

🎉 **恭喜！您已獲得一個 100% 前端防護、高安全性的私人反向機票管理系統。**
