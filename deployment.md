# 🛠️ Light Trip Plan 生產環境部署與 API 安全設定指南

**Light Trip Plan** 採用現代化 **Jamstack + Serverless** 雲原生架構：
* **前端 (Client SPA / PWA)**：100% 靜態 React 應用程式，預設支援透過 **GitHub Actions** 自動化建置並發布至 **GitHub Pages** 或任何靜態託管平台。
* **安全代理 (Cloudflare Worker)**：作為微型邊緣安全閘道 (Edge Gateway)，負責轉發第三方航班查詢 API、隱藏真實 API 金鑰、強制 512KB Payload 限制、強制 HTTPS 與防 SSRF/Open Redirect。
* **雲端同步 (Google Cloud OAuth 2.0)**：純前端授權直連 Google Drive API，提供使用者個人加密備份與 500MB 大檔斷點續傳。

---

## 🏗️ 系統拓撲與資料流向

```
┌────────────────────────────────────────────────────────┐
│                   使用者瀏覽器 / PWA                    │
│   (IndexedDB 11 個 Stores 本地儲存 + MapLibre 向量引擎) │
└──────┬────────────────────┬────────────────────┬───────┘
       │                    │                    │
       │ (1) OAuth 直連     │ (2) 靜態託管       │ (3) 帶鑑權轉發
       ▼                    ▼                    ▼
┌──────────────┐    ┌───────────────┐    ┌────────────────────────┐
│ Google Cloud │    │ GitHub Pages  │    │ Cloudflare Worker 代理 │
│  Drive API   │    │  (Vite Build) │    │  (Payload 512KB 限制)  │
└──────────────┘    └───────────────┘    └───────────┬────────────┘
                                                     │ 隱藏金鑰查詢
                                                     ▼
                                         ┌────────────────────────┐
                                         │ AviationStack / AirLabs│
                                         └────────────────────────┘
```

---

## 🔑 第一步：申請與設定 Google OAuth 憑證 (個人備份與大檔直傳)

本系統使用 Google OAuth 2.0 Web Client ID 讓使用者登入自己的 Google 帳號，直接在瀏覽器與個人 Google Drive 之間傳輸備份與上傳大檔：

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)。
2. 建立新專案（例如 `light-trip-plan`）。
3. 前往 **API 和服務** > **程式庫**，搜尋並啟用：
   * `Google Drive API`
4. 前往 **OAuth 同意畫面 (OAuth consent screen)**：
   * User Type 選擇 **外部 (External)**。
   * 填寫應用程式名稱 (`Light Trip Plan`) 與開發者電子郵件。
   * 在 **範圍 (Scopes)** 中新增：
     * `https://www.googleapis.com/auth/drive.file`（僅存取本系統建立之檔案，最安全）
5. 前往 **憑證 (Credentials)** > **建立憑證** > **OAuth 用戶端 ID**：
   * 應用程式類型：**網頁應用程式 (Web application)**。
   * **已獲授權的 JavaScript 來源 (Authorized JavaScript origins)**：
     * 本地開發：`http://localhost:5173`
     * 正式生產：`https://<your-username>.github.io`
   * **已獲授權的重新導向 URI (Authorized redirect URIs)**：
     * 同上述網址。
6. 複製產生的 **用戶端 ID (Client ID)**，此即為環境變數 `VITE_GOOGLE_CLIENT_ID`。

---

## 🛡️ 第二步：部署 Cloudflare Worker 安全邊緣代理 (推薦)

**資安原則**：若直接將第三方付費 API 金鑰（如 AviationStack、AirLabs）放入前端，訪客開啟 F12 即能竊取並盜刷。我們在 `cloudflare-worker/` 提供了預先加固的邊緣代理程式。

### 1. 本地安裝 Wrangler CLI
```bash
npm install -g wrangler
wrangler login
```

### 2. 加密儲存金鑰至 Cloudflare KV / Secrets
進入專案目錄下的 `cloudflare-worker/`：
```bash
cd cloudflare-worker

# 儲存航班 API 金鑰 (非必填，依您需求)
wrangler secret put AVIATIONSTACK_API_KEY
wrangler secret put AIRLABS_API_KEY

# [強烈建議] 設定自訂 Bearer 鑑權 Token，防止他人調用您的 Worker
wrangler secret put SHARE_SECRET_TOKEN
```

### 3. 一鍵發布
```bash
wrangler deploy
```
部署成功後，終端機將輸出 Worker 專屬網址，例如：
`https://light-trip-proxy.<your-subdomain>.workers.dev`
請記下此網址，此即為 `VITE_FLIGHT_PROXY_URL`。

### 邊緣代理內建安全特性：
* **512KB Payload 門檻**：超過 512KB 直接回傳 HTTP 413，杜絕大檔惡意攻擊 Worker 記憶體。
* **UUID 格式校驗**：針對分享與旅程 ID 進行嚴格正則驗證 (`/^[0-9a-f]{8}-[0-9a-f]{4}-...$/i`)。
* **強制 HTTPS 與參數消毒**：所有對外請求強制採用 HTTPS，並對 Query 參數進行 `encodeURIComponent`，杜絕 SSRF 與 Open Redirect 漏洞。

---

## 🚀 第三步：設定 GitHub Repository 變數與自動化部署 (CI/CD)

本專案配置了嚴格的自動化部署工作流程 (`.github/workflows/deploy.yml`)，遵循「**不修復不上線**」原則：在發布前強制執行 `npm run lint` 與 `npm test`。

請至 GitHub 專案頁面：`Settings` > `Secrets and variables` > `Actions`：

### 1. Variables (公開變數)
| 變數名稱 | 必填 | 說明 | 範例值 |
| :--- | :---: | :--- | :--- |
| `VITE_GOOGLE_CLIENT_ID` | ✅ 必備 | Google OAuth Client ID | `123456-xxx.apps.googleusercontent.com` |
| `VITE_FLIGHT_PROXY_URL` | 🟢 推薦 | 部署完成之 Cloudflare Worker 網址 | `https://light-trip-proxy.xxx.workers.dev` |
| `VITE_MAPBOX_API_KEY` | ⚪ 選配 | Mapbox 備援 Token（系統預設使用免金鑰的 OpenFreeMap） | `pk.eyJ1Ijo...` |
| `VITE_GOOGLE_MAPS_API_KEY` | ⚪ 選配 | Google Maps 備援 Token（若需使用 Google 原生路網） | `AIzaSy...` |

### 2. 觸發自動發布
將程式碼 Push 或 Merge 至 `main` 分支，GitHub Actions 將依序執行：
1. `npm ci`（嚴格安裝鎖定依賴）
2. `npm run lint`（靜態檢查，0 錯誤 0 警告門禁）
3. `npm test`（單元測試，31/31 測試通過門禁）
4. `npm run build`（Vite 生產環境打包與 PWA Service Worker 生成）
5. 部署至 `gh-pages` 分支。

---

## 🤖 第四步：LINE Bot 定時推播行程通知 (選配)

本專案支援透過 GitHub Actions 定時觸發 `scripts/line-bot.js`，自動向使用者的 LINE 帳號推播當日與即將出發之航班、飯店及行程提醒。

### 1. 取得 LINE Messaging API 憑證
1. 前往 [LINE Developers Console](https://developers.line.biz/)。
2. 建立 Messaging API Channel，獲取：
   * `LINE_CHANNEL_ACCESS_TOKEN` (Long-lived Channel Access Token)
   * `LINE_USER_ID` (您個人在 LINE 中的 User ID，非一般顯示 ID)

### 2. 設定 GitHub Secrets
在 GitHub 的 `Settings` > `Secrets and variables` > `Actions` > **Secrets** 中加入：
* `LINE_CHANNEL_ACCESS_TOKEN`
* `LINE_USER_ID`
* `GOOGLE_CLIENT_ID`
* `GOOGLE_CLIENT_SECRET`
* `GOOGLE_REFRESH_TOKEN` (透過 OAuth Playground 取得之持久性 Refresh Token，用於無頭讀取 Google Drive 備份)

---

## 📱 第五步：PWA 離線安裝與快取策略

**Light Trip Plan** 具備完備的 PWA (Progressive Web App) 能力：
* **Service Worker**：基於 `workbox` 自動更新機制 (`autoUpdate`)。
* **Google Fonts 快取**：快取字型資源長達 365 天，離線時介面文字不閃爍。
* **離線圖資**：MapLibre 搭配 OpenFreeMap 與內建 7,917+ 全球機場離線庫，即使在飛行模式或無網路狀態下，仍可順暢瀏覽旅程與查詢航班代碼。

---

## 🔍 第六步：零成本除錯診斷指南 (Diagnostic Runbook)

當使用者在行動端或離線環境回報異常時，請指導使用者匯出**除錯診斷包**：

1. **取得診斷包**：
   * 若介面發生嚴重 React 渲染錯誤，Error Boundary 畫面將提供「📥 下載系統除錯診斷包 (Diagnostic Dump)」按鈕。
   * 平時亦可於頂部導航列之「匯入匯出 & 手冊」>「資料匯出」頁籤下載。
2. **診斷包內含數據**：
   * `environment`：瀏覽器 UserAgent、螢幕解析度、網路線上狀態 (`isOnline`) 與當前路由。
   * `storage.storesRecordCount`：IndexedDB 11 個 Stores 的目前筆數統計與健康狀態。
   * **個資保護**：報告不含任何個人機票確認碼、姓名或花費金額，安全無虞。
3. **Google OAuth `invalid_grant` 排查**：
   * 此錯誤代表 Refresh Token 已過期、使用者修改了 Google 帳號密碼，或測試應用程式授權超過 7 天。
   * 解決方案：重新於 Google OAuth Playground 獲取新的 `refresh_token` 並更新至 GitHub Secret。

