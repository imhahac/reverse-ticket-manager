# 航班反向票購買管理系統 (Reverse Ticket Manager)

這是一個純前端的靜態網頁應用程式，專為喜愛利用「反向機票」策略節省機票費用、或是頻繁往返兩地的旅客所設計。

系統能將多張不同方向的來回機票（正向票與反向票）自動解構，並依照時間軸重新配對成你實際出發的飛行「趟次」，清楚顯示每一趟的去程與回程，避免行程日期混淆。

## 線上 Demo
[https://imhahac.github.io/reverse-ticket-manager/](https://imhahac.github.io/reverse-ticket-manager/)

## 🌟 核心功能 (v4.0 雲端升級版)

*   🎟️ **機票訂單管理**：手動輸入機票價格、航班日期，並高度彈性指定為「正向票」(台灣出發)、「反向票」(外站出發)，或是「單程票 (One-way)」。支援外幣並自動帶入基準匯率換算。
*   ✈️ **航班自動配對**：系統自動將所有機票拆分成單程航段，按照時間先後順序排列，並自動配對為實際旅行趟次。
*   🔀 **不同點進出 (Open-Jaw)**：支援寬鬆比對。即使去回程不同點（例如飛東京、從大阪回），系統只要認得是「出台灣 ➜ 回台灣」就會配對，並聰明標記出這是一趟「不同點進出」行程。
*   ☁️ **雲端跨裝置同步 (新)**：無須建置後端伺服器！前端透過 Google OAuth 直接將您的機票資料 (`reverse-tickets.json`) 安全儲存於您個人的 Google Drive 中，並可隨時載入覆寫。
*   📅 **一鍵同步 Google 日曆 (新)**：點擊「同步日曆」，系統自動幫您在 Google Calendar 創建全天候的航班事件，行程不漏接。
*   🔔 **LINE Bot 自動推播 (新)**：結合 GitHub Actions 每日定時檢查機票表，只要是「3天後」或「明天」出發的航班，您的 LINE 就會收到貼心行前提醒！

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

如果您想自己建置 (Self-host) 或測試這套雲端系統，請參考以下步驟：

### 1. 前端環境變數與啟動 (.env)

系統使用 Vite 框架。請在專案根目錄建立一個 `.env.local` 檔案。
```bash
VITE_GOOGLE_CLIENT_ID=你的_Google_OAuth_Client_ID
```
*(如何取得: 請至 [Google Cloud Console](https://console.cloud.google.com/) 建立專案，選擇「API 和服務」>「憑證」，建立一個 OAuth 2.0 用戶端 ID)*

**⚠️ 重要必做步驟 (啟用 API)：**
建立專案後，您必須在 Google Cloud Console 左側的「資料庫與服務 (Library)」中，手動搜尋並**啟用 (Enable)** 以下兩個服務，否則登入後會報錯 403：
1. `Google Drive API`
2. `Google Calendar API`

啟動本地開發環境：
```bash
npm install
npm run dev
```

### 2. GitHub Pages 前端部署 (含 Client ID 注入)

系統內附了 `.github/workflows/deploy.yml`。
1. 進入您 GitHub Repository 的 `Settings` > `Secrets and variables` > `Actions`。
2. 點擊 `New repository secret`，名稱填寫 `GOOGLE_CLIENT_ID`，數值填入您的 Google Client ID。
3. 每次推送 `main` 分支時，GitHub Actions 會自動將此 Secret 注入靜態網頁中。

### 3. 設定每日 LINE 推播 (GitHub Actions)

每天特定時段 (依 `cron` 設定)，系統內附的 `.github/workflows/line-bot-cron.yml` 會自動運行。這支腳本需要您的授權去讀取 Google Drive 並發送 LINE。

請至 GitHub Repository `Settings` > `Secrets` 加入以下三把金鑰：
1. `GOOGLE_SERVICE_ACCOUNT_CREDENTIALS`: 在 Google Cloud 建立「服務帳戶」並產生 JSON 金鑰。將內容貼入此處。並且記得至 Google Drive 將 `reverse-tickets.json` 的讀取權限分享給該服務帳戶的信箱！
2. `LINE_CHANNEL_ACCESS_TOKEN`: 至 LINE Developers 建立 Messaging API Channel 產生的長效 Token。
3. `LINE_USER_ID`: 您的個人 LINE User ID (以 U 開頭)。

## 授權條款

MIT License
