# 航班反向票購買管理系統 (Reverse Ticket Manager)

這是一個純前端的靜態網頁應用程式，專為喜愛利用「反向機票」策略節省機票費用、或是頻繁往返兩地的旅客所設計。

系統能將多張不同方向的來回機票（正向票與反向票）自動解構，並依照時間軸重新配對成你實際出發的飛行「趟次」，清楚顯示每一趟的去程與回程，避免行程日期混淆。

## 線上 Demo
[https://imhahac.github.io/reverse-ticket-manager/](https://imhahac.github.io/reverse-ticket-manager/)

## 🌟 核心功能 (v5.0 智慧配對與精確同步版)

*   🎟️ **機票訂單管理**：手動輸入機票價格、航班日期與 **精確時間 (HH:mm)**，並高度彈性指定為「正向票」(台灣出發)、「反向票」(外站出發)，或是「單程票 (One-way)」。支援外幣並自動帶入基準匯率換算。
*   ✏️ **訂單修改與管理**：支援隨時修改已購買的機票訂單。填錯日期、票價或航班編號都能無縫更新，系統會自動重新精算與配對您的趟次！
*   ✈️ **智慧航班配對**：系統自動將所有機票拆分成單程航段，按照時間先後順序排列，並以「台灣」為起終點進行 **智慧趟次配對 (Smart Grouping)**，清楚顯示真正的出國趟次。
*   🔀 **不同點進出 (Open-Jaw)**：支援寬鬆比對。即使去回程不同點（例如飛東京、從大阪回），系統只要認得是「出台灣 ➜ 回台灣」就會配對，並聰明標記出這是一趟「不同點進出」行程。
*   ☁️ **雲端跨裝置同步**：無須建置後端伺服器！前端透過 Google OAuth 直接將您的機票資料 (`reverse-tickets.json`) 安全儲存於您個人的 Google Drive 中，並可隨時載入覆寫。
*   📅 **智慧同步 Google 日曆 (升級)**：支援精準時分寫入日曆。系統會記住建立過的事件 ID，若修改航班再次同步，會 **自動覆寫更新現有事件**，不再產生重複的日曆行程！
*   🔔 **LINE Bot 自動推播 (升級)**：結合 GitHub Actions 每日定時檢查機票表，只要是「3天後」或「明天」出發的航班，您的 LINE 就會收到包含 **航點、精準時間** 的貼心行前提醒！

## 🏗️ 系統架構理念 (Serverless)

全系統採用 **無伺服器 (Serverless)** 方案降低維運成本，並且強調 **隱私至上**。您的資料只存在於您的瀏覽器、以及您個人的 Google 帳號與 GitHub 儲存庫內。

*   **前端介面**: React (Vite) + Tailwind CSS + `@react-oauth/google`
*   **資料儲存**: LocalStorage (未登入狀態) / Google Drive API (登入狀態)
*   **日曆同步**: Google Calendar API
*   **自動推播**: GitHub Actions (Cron) + Node.js Script + LINE Messaging API

## 什麼是「反向票」？

反向票的核心邏輯是將兩張不同方向的來回票串接，在特定節慶或連假期間，外站出發的價格通常遠低於台灣出發。
*   **第 1 套票 (反向)**：日本 ➜ 台灣（今年 5 月）+ 台灣 ➜ 日本（今年 9 月）
*   **第 2 套票 (正向)**：台灣 ➜ 日本（今年 5 月）+ 日本 ➜ 台灣（今年 9 月）
**組合後的實際行程**：
*   趟次 1：台灣 (5月去, 正向) ➜ 日本 ➜ 台灣 (5月回, 反向)
*   趟次 2：台灣 (9月去, 反向) ➜ 日本 ➜ 台灣 (9月回, 正向)

這套系統就是用來幫你清楚釐清這多段交錯的航程，並精算平均成本。

## 🛠️ 安裝與部署指南

如果您想自己建置 (Self-host) 或測試這套雲端系統，請參考以下詳細步驟。整個架構分為「前端授權」與「後端排程」，皆不需自建伺服器。

### 第一步：申請 Google OAuth Client ID (.env)

因為系統需要連接個人的 Google Drive 與 Calendar，您必須自行去 Google Cloud 申請一把專屬鑰匙：
1. 進入 [Google Cloud Console](https://console.cloud.google.com/)。
2. 點擊頂部建立一個全新的專案 (例如：`Reverse Ticket App`)。
3. **⚠️ 啟用 API (關鍵！不然會報錯 403)**：
   在左側選單的「API 和服務」>「啟用 API 和服務」，搜尋並點擊「**啟用 (Enable)**」以下兩個服務：
   * `Google Drive API`
   * `Google Calendar API`
4. **設定 OAuth 同意畫面**：
   在「API 和服務」>「OAuth 同意畫面」，選擇「外部 (External)」。
   填妥必填的 App 名稱與信箱。在 **「測試使用者 (Test users)」** 區塊，**務必加入您自己平常使用的 Google 信箱！**
5. **建立憑證**：
   在左側點擊「憑證 (Credentials)」，選擇「建立憑證」>「OAuth 用戶端 ID」。
   應用程式類型選「網頁應用程式 (Web application)」。
   在 **「已授權的 JavaScript 來源」** 加入：
   * `http://localhost:5173` (本地測試用)
   * `https://您的GitHub帳號.github.io` (部署後用)
6. 建立後，您會獲得一串 Client ID。請在專案根目錄建立 `.env.local` 檔案填入：
   ```bash
   VITE_GOOGLE_CLIENT_ID=你的_Google_OAuth_Client_ID
   ```

啟動本地開發環境：
```bash
npm install
npm run dev
```

### 第二步：部署到 GitHub Pages

此專案已內建自動部署的工作流程 (`.github/workflows/deploy.yml`)，您只需要安全地注入 Client ID：
1. 將專案 Push 到您自己的 GitHub 儲存庫。
2. 進入 Repository 的 `Settings` > `Secrets and variables` > `Actions`。
3. 點擊 `New repository secret`，名稱填寫 `GOOGLE_CLIENT_ID`，數值填入第一步獲得的 Client ID。
4. 未來只要 Push 到 `main` 分支，系統便會自動將網站與金鑰打包部署！

### 第三步：設定每日 LINE 推播機器人 (GitHub Actions)

每天特定時段 (依 `cron` 設定，預設為每早 8 點)，`.github/workflows/line-bot-cron.yml` 會被喚醒去檢查航班。這支腳本需要您的授權去讀取機票並發送 LINE。

請依照以下清單，到 GitHub Repository `Settings` > `Secrets` 加入三把金鑰：
1. `GOOGLE_SERVICE_ACCOUNT_CREDENTIALS` (重要)：
   * 在 Google Cloud 的「憑證」中建立一個「服務帳戶 (Service Account)」。
   * 為該帳戶建立並下載 JSON 格式的金鑰，將檔案內的「全部 JSON 字串」完整貼入此 Secret。
   * **(💡 核心步驟)**：到您個人的 Google Drive，找到系統幫您備份的 `reverse-tickets.json` 檔案。對它點擊共用，將該「服務帳戶的 Email (結尾是 `iam.gserviceaccount.com`)」加入，並給予**檢視者 (Viewer)** 權限！沒有這步後端排程會讀不到檔案！
2. `LINE_CHANNEL_ACCESS_TOKEN`：
   * 前往 [LINE Developers](https://developers.line.biz/)，建立一個 Messaging API Channel。
   * 在 Messaging API 分頁最下方發行一組長時間有效的 `Channel access token`。
3. `LINE_USER_ID`：
   * 在同一個 LINE Channel 設定頁面的 Basic Settings 最底部，可找到您的個人 User ID (必定以 `U` 開頭)，將其填入，讓機器人知道要把訊息傳給誰。

## 授權條款

MIT License
