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

**⚠️ 嚴重警告**：本專案為無後端架構，若直接將航班查詢 API (AviationStack/AirLabs) 金鑰放進 GitHub Secrets 作為純前端變數，網頁上線後任何人都可透過瀏覽器 (F12) 看見您的金鑰並盜刷額度。

為了解決此安全風險，我們在專案原始碼中提供了一個預先寫好的 Proxy 腳本 (`cloudflare-worker/worker.js`)。請跟隨以下步驟，免費架設您的專屬 Serverless Proxy 來隱藏付費金鑰：

**1. 初始化 Worker 環境**
請開啟終端機並確保已安裝 [Node.js](https://nodejs.org/)。
```bash
# 進入專案內的 worker 目錄
cd cloudflare-worker

# 全域安裝 Cloudflare 的命令列工具 Wrangler
npm install -g wrangler
```

**2. 將金鑰加密推上 Cloudflare 伺服器**
請**不要**將金鑰寫進程式碼。利用 Wrangler 將您申請的金鑰安全地儲存為雲端變數：
```bash
wrangler secret put AVIATIONSTACK_API_KEY
# 終端機會提示您，請貼上真正的 AviationStack API 金鑰

wrangler secret put AIRLABS_API_KEY
# 終端機會提示您，請貼上真正的 AirLabs API 金鑰
```

**3. 部署 Proxy 上線**
```bash
wrangler deploy
# 部署完成後，您會獲得一段專屬的安全網址
# (例如：https://flight-proxy.yourname.workers.dev)
```

**4. 替換 GitHub Secrets 連線設定**
取得那段專屬網址後，請回到您 GitHub Repo 的 `Settings` > `Secrets and variables` > `Actions`：
- **新增** `VITE_FLIGHT_PROXY_URL`，值設為剛才取得的 Proxy 網址 (Ex: `https://flight-proxy.yourname.workers.dev`)。
- *(如果您之前有設定 `VITE_AVIATIONSTACK...` 等變數，為確保安全，強烈建議將它們刪除)*。

完成！系統前端原始碼已經過全面加固，會自動統一透過您架設的 Proxy 來向 AviationStack 與 AirLabs 發起安全的請求！
