# 🛠️ Light Trip Plan 生產環境部署與 API 安全設定指南

**Light Trip Plan** 採用現代化 **Jamstack + Serverless** 雲原生架構：
* **前端 (Client SPA / PWA)**：100% 靜態 React 應用程式，透過 **GitHub Actions** 自動化建置並發布至 **GitHub Pages**。
* **安全代理 (Cloudflare Worker)**：作為微型邊緣安全閘道 (Edge Gateway)，負責轉發第三方航班查詢 API、儲存唯讀行程分享快照 (KV)、強制 512KB Payload 限制與防 SSRF。
* **雲端同步 (Google Cloud OAuth 2.0)**：純前端授權直連 Google Drive API，提供使用者個人加密備份與 500MB 大檔斷點續傳。
* **排程通知 (LINE Bot)**：透過 GitHub Actions Cron 排程讀取 Google Drive 備份，推播每日航班與住宿通知。

---

## 🏗️ 系統拓撲與資料流向

```
┌────────────────────────────────────────────────────────┐
│                   使用者瀏覽器 / PWA                    │
│   (IndexedDB 11 個 Stores 本地儲存 + MapLibre 向量引擎) │
└──────┬────────────────────┬────────────────────┬───────┘
       │                    │                    │
       │ (1) OAuth 直連     │ (2) 靜態託管       │ (3) 帶鑑權轉發 / 分享快照
       ▼                    ▼                    ▼
┌──────────────┐    ┌───────────────┐    ┌────────────────────────┐
│ Google Cloud │    │ GitHub Pages  │    │ Cloudflare Worker 代理 │
│  Drive API   │    │ (GitHub Action│    │ (KV 快照 + 512KB 限制) │
└──────────────┘    └───────────────┘    └───────────┬────────────┘
                                                     │ 隱藏金鑰查詢
                                                     ▼
                                         ┌────────────────────────┐
                                         │ AviationStack / AirLabs│
                                         └────────────────────────┘
```

---

## 📌 部署前置核對清單 (Pre-flight Checklist)

在開始前，請確認以下兩個最常見的「卡關死角」：

1. **GitHub Pages 部署來源設定**：
   * 前往 GitHub 儲存庫 `Settings` ➔ `Pages` ➔ `Build and deployment`。
   * **Source** 必須選擇 **`GitHub Actions`**（⚠️ 勿選 `Deploy from a branch`）。
2. **專案路徑 Base Path**：
   * 專案 `vite.config.js` 預設為 `base: '/reverse-ticket-manager/'`。
   * 若您的 GitHub 儲存庫名稱為 `reverse-ticket-manager`，則無須修改；若改名為 `my-trip`，請同步修改 `vite.config.js` 中的 `base: '/my-trip/'`。

---

## 🔑 第一步：申請與設定 Google OAuth 憑證

本系統使用 Google OAuth 2.0 Web Client ID 讓使用者登入自己的 Google 帳號，直接在瀏覽器與個人 Google Drive 之間傳輸備份：

### 1. 建立專案與啟用 API
1. 前往 [Google Cloud Console](https://console.cloud.google.com/)。
2. 建立新專案（例如 `light-trip-plan`）。
3. 前往 **API 和服務** > **程式庫**，搜尋並啟用：
   * `Google Drive API`

### 2. 設定 OAuth 同意畫面 (OAuth consent screen)
1. User Type 選擇 **外部 (External)**，點擊建立。
2. 填寫應用程式名稱（如 `Light Trip Plan`）與使用者支援電子郵件。
3. 在 **範圍 (Scopes)** 步驟點擊「新增或移除範圍」，手動勾選或填入：
   * `https://www.googleapis.com/auth/drive.file`（僅存取本系統建立之檔案，權限最小最安全）
4. 在 **測試使用者 (Test users)** 步驟加入您自己的 Google 帳號（未通過 Google 驗證前，僅清單內帳號可登入）。

### 3. 建立 Web 用戶端憑證（⚠️ 嚴格遵循網址格式）
前往 **憑證 (Credentials)** > **建立憑證** > **OAuth 用戶端 ID**：
* 應用程式類型：**網頁應用程式 (Web application)**。
* **已獲授權的 JavaScript 來源 (Authorized JavaScript origins)**：
  > ⚠️ 注意：Origins **嚴禁包含任何子路徑**，結尾不得有斜線！
  * 本地開發：`http://localhost:5173`
  * 正式生產：`https://<your-username>.github.io`
* **已獲授權的重新導向 URI (Authorized redirect URIs)**：
  > ⚠️ 注意：必須精確匹配前端進入點（包含 Repository 子路徑）：
  * 本地開發：`http://localhost:5173`
  * 本地開發：`http://localhost:5173/`
  * 本地開發：`http://localhost:5173/reverse-ticket-manager/`
  * 正式生產：`https://<your-username>.github.io/reverse-ticket-manager/`
* 點擊建立後，儲存產生的 **用戶端 ID (Client ID)** 與 **用戶端密碼 (Client Secret)**。

---

## 🛡️ 第二步：設定 Cloudflare Worker 與 KV（唯讀分享與安全代理）

系統提供行程唯讀分享（30 天自動過期快照）與第三方 API 安全轉發。

### 1. 建立 Cloudflare KV Namespace (共通必備)
1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2. 左側選單點選 **Workers & Pages** ➔ **KV**。
3. 點選 **Create namespace**，名稱輸入 `SHARED_TRIPS`。
4. 建立後，請複製該命名空間的 **Namespace ID**（例如 `a1b2c3d4e5f67890123456789abcdef0`）。

### 2. 選擇部署途徑

#### 路徑 A：GitHub Actions 自動部署（推薦，零維護）
1. 取得 Cloudflare API Token：
   * 前往 Cloudflare 右上角人像 ➔ **My Profile** ➔ **API Tokens**。
   * 點選 **Create Token** ➔ 選擇 **Edit Cloudflare Workers** 模板。
   * 確認具備 `Workers Scripts: Edit` 權限，Account / Zone 選擇您的帳戶。
   * 建立並複製產生的 Token（僅顯示一次）。
2. 在 GitHub 儲存庫設定：
   * **Secret**: `CLOUDFLARE_API_TOKEN` = 您的 Cloudflare API Token。
   * **Variable**: `SHARED_TRIPS_KV_ID` = 剛才複製的 KV Namespace ID。
3. 每次推送到 `main` 分支時，CI/CD 會自動注入 KV ID 並完成發布。

#### 路徑 B：本地手動發布 (Wrangler CLI)
1. 本機安裝 Wrangler 並登入：
   ```bash
   npm install -g wrangler
   wrangler login
   ```
2. 進入 `cloudflare-worker/` 資料夾，編輯 `wrangler.toml`：
   ```toml
   # 將 __KV_ID__ 替換為真實的 KV Namespace ID
   [[kv_namespaces]]
   binding = "SHARED_TRIPS"
   id = "a1b2c3d4e5f67890123456789abcdef0"
   ```
3. 設定金鑰與發布：
   ```bash
   # (選填) 設定第三方航班 API 金鑰
   wrangler secret put AVIATIONSTACK_API_KEY
   wrangler secret put AIRLABS_API_KEY

   # 發布
   wrangler deploy
   ```
4. 發布完成後終端機輸出的網址（如 `https://flight-api-proxy.<your-subdomain>.workers.dev`）即為 `VITE_FLIGHT_PROXY_URL`。

---

## 🚀 第三步：設定 GitHub Repository Secrets 與 Variables

前往 GitHub 儲存庫：`Settings` ➔ `Secrets and variables` ➔ `Actions`。

### 1. Repository Secrets (機密設定)
點選 **New repository secret**：

| Secret 名稱 | 必填 | 說明 | 範例 / 取得來源 |
| :--- | :---: | :--- | :--- |
| `GOOGLE_CLIENT_ID` | ✅ 必備 | Google OAuth 用戶端 ID | `123456-xxx.apps.googleusercontent.com` |
| `CLOUDFLARE_API_TOKEN` | 🟢 推薦 | 具備 Workers 編輯權限之 Token (自動部署 Worker 用) | `_x8AbC...` |
| `VITE_AVIATIONSTACK_API_KEY` | ⚪ 選配 | AviationStack 航班查詢 API Key | `d8a7b6...` |
| `VITE_AIRLABS_API_KEY` | ⚪ 選配 | AirLabs 航班查詢 API Key | `e9f8c7...` |
| `VITE_MAPBOX_API_KEY` | ⚪ 選配 | Mapbox 圖資備援 Token（預設走免 Key 的 OpenFreeMap） | `pk.eyJ1Ijo...` |
| `VITE_GOOGLE_MAPS_API_KEY` | ⚪ 選配 | Google Maps 備援 Token | `AIzaSy...` |

### 2. Repository Variables (公開變數)
切換至 **Variables** 頁籤，點選 **New repository variable**：

| Variable 名稱 | 必填 | 說明 | 範例值 |
| :--- | :---: | :--- | :--- |
| `VITE_FLIGHT_PROXY_URL` | 🟢 推薦 | 部署完成的 Cloudflare Worker 網址 | `https://flight-api-proxy.xxx.workers.dev` |
| `SHARED_TRIPS_KV_ID` | 🟢 推薦 | Cloudflare KV 命名空間 ID (自動部署 Worker 用) | `a1b2c3d4e5f6...` |

---

## ⚙️ 第四步：自動化 CI/CD 發布門禁

當代碼推送到 `main` 分支時，`.github/workflows/deploy.yml` 將自動執行嚴格防線：

1. **依賴鎖定**：`npm install` 依賴鎖定與結構驗證。
2. **語法與代碼風格門禁**：`npm run lint`（強制 **0 錯誤、0 警告**）。
3. **單元測試全數門禁**：`npm test`（強制 **21 個測試檔案、55 個單元測試** 100% 通過）。
4. **生產環境打包**：`npm run build`（注入環境變數、生成 PWA Service Worker 與預載入資產）。
5. **發布至 GitHub Pages**：調用官方 `actions/deploy-pages@v5` 進行零停機熱發布。
6. **(選用) 自動發布 Cloudflare Worker**：若有設定 `CLOUDFLARE_API_TOKEN` 與 `SHARED_TRIPS_KV_ID`，自動更新邊緣代理程式。

---

## 🤖 第五步：LINE Bot 定時行程通知 (選配)

本專案支援透過 GitHub Actions Cron 排程（每天早上 8:15 台灣時間）自動讀取 Google Drive 備份，推播當日與即將到來的行程、航班、飯店資訊。

### 1. 取得 LINE Messaging API 憑證
1. 前往 [LINE Developers Console](https://developers.line.biz/)。
2. 建立 Provider ➔ 建立 Messaging API Channel。
3. 取得：
   * **Channel access token (long-lived)**（長期存取權杖）。
   * **Your user ID**（位於 Basic settings 頁籤最底部的個人 User ID，非一般好友 ID）。

### 2. 取得持久性 Google Refresh Token（SOP 操作，拒絕猜測）
由於 GitHub Actions 是無頭無瀏覽器環境，必須使用持久性的 `refresh_token` 向 Google 換取存取權限：

1. 前往 [Google OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)。
2. 點擊右上角齒輪圖示 **Configuration** ⚙️：
   * 勾選 **`Use your own OAuth credentials`**（⚠️ 極度重要！否則取得的 token 無法使用）。
   * **OAuth Client ID**：貼上您在第一步申請的 Google Client ID。
   * **OAuth Client secret**：貼上您的 Google Client Secret。
3. 在左側 **Step 1 Select & authorize APIs**：
   * 在下方 `Input your own scopes` 輸入框中填入：
     `https://www.googleapis.com/auth/drive.file`
   * 點擊 **Authorize APIs**。
4. 在彈出視窗登入您的 Google 帳號，並在安全警告畫面點選「進階」➔「前往 (不安全)」，勾選權限後同意。
5. 回到 Playground 介面，在 **Step 2 Exchange authorization code for tokens**：
   * 點擊 **`Exchange authorization code for tokens`**。
6. 在右側欄位中，找到 **`Refresh token`** 並複製該字串。

### 3. 設定 GitHub Secrets
在 GitHub `Settings` ➔ `Secrets and variables` ➔ `Actions` ➔ **Secrets** 加入：
* `LINE_CHANNEL_ACCESS_TOKEN`
* `LINE_USER_ID`
* `GOOGLE_CLIENT_ID`
* `GOOGLE_CLIENT_SECRET`
* `GOOGLE_REFRESH_TOKEN`

---

## 📱 第六步：PWA 離線安裝與快取策略

* **Service Worker 自動更新**：基於 `workbox-window` 實現靜默下載與版本平滑過渡。
* **Google Fonts 永久快取**：快取字型資源長達 365 天，離線時無任何字型抽搐或閃爍。
* **全球離線機場庫**：內建 7,917+ 全球機場離線經緯度與時區庫，即使在機上飛行模式，地圖與航班仍可流暢檢視。

---

## 🔍 第七步：故障排除與診斷 SOP (Runbook)

### 1. GitHub Pages 打開反白或 404
* **排查點**：檢視瀏覽器主控台 (F12)。
* **原因**：通常是 `vite.config.js` 的 `base` 與 GitHub 儲存庫名稱不一致。
* **解決**：若儲存庫網址為 `https://username.github.io/my-repo/`，則 `vite.config.js` 必須為 `base: '/my-repo/'`。

### 2. Google 登入報錯 `400: redirect_uri_mismatch`
* **原因**：Google Cloud Console 內設定的重新導向網址與當前頁面網址不吻合。
* **解決**：確保 Google Console 中的「已獲授權的重新導向 URI」包含 `https://<your-username>.github.io/reverse-ticket-manager/`（注意結尾斜線）。

### 3. Google OAuth 登入彈出 `invalid_grant`
* **原因**：Google 測試版專案的 OAuth Token 預設有效期限為 7 天，或是密碼修改導致失效。
* **解決**：重新至 Google OAuth Playground 獲取新的 `refresh_token`，更新至 GitHub Secrets。

### 4. 系統除錯診斷包匯出
* 介面發生嚴重異常時，Error Boundary 會自動提供「📥 下載除錯診斷包 (Diagnostic Dump)」。
* 平時亦可於導航列「匯入匯出 & 手冊」➔「資料匯出」中下載，包含 IndexedDB 11 個 Stores 的健康狀態與環境指標，不含個人機密。
