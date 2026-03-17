# 航班反向票購買管理系統 (Reverse Ticket Manager)

這是一個純前端的靜態網頁應用程式，專為喜愛利用「反向機票」策略節省機票費用、或是頻繁往返兩地的旅客所設計。

系統能將多張不同方向的來回機票（正向票與反向票）自動解構，並依照時間軸重新配對成你實際出發的飛行「趟次」，清楚顯示每一趟的去程與回程，避免行程日期混淆。

## 線上 Demo

[https://imhahac.github.io/reverse-ticket-manager/](https://imhahac.github.io/reverse-ticket-manager/)

---

## 🌟 核心功能 (v6.0)

| 功能 | 說明 |
|---|---|
| 🎟️ **機票訂單管理** | 支援正向票、反向票、單程票；輸入精確時間 (HH:mm)；多幣別 (TWD/JPY/USD) + 即時匯率 |
| ✏️ **訂單修改** | 隨時修改日期、票價、航班編號，系統自動重新精算配對 |
| ✈️ **智慧趟次配對** | 以台灣機場為邊界，自動配對出國趟次；支援外站轉機、不同點進出 (Open-Jaw) |
| 🏨 **住宿防呆警示** | 趟次內若發現住宿日期重疊或有未安排住宿的缺口，會自動於行程卡片提示警告 |
| 🌙 **紅眼航班自動校正** | 填入抵達時間早於出發時間時，系統自動 **+1 天**，不報錯，直接修正 |
| ⏳ **轉機時間視覺化** | 中轉航段自動計算停留時間，顯示「✈ NRT 轉機 3h15m」標籤 |
| 💰 **費用三分類統計** | 入帳總計 / 未來待出行 / 歷史已實現 / 未配對成本（孤兒票警示） |
| 🔀 **手動重組航段** | 可拖曳航段跨趟次調整，或點擊「從趟次移除」重組配對 |
| ☁️ **Google Drive 同步** | 無後端伺服器，前端直接授權備份至個人 Google Drive |
| 📅 **Google 日曆同步** | 精準時分寫入日曆；住宿轉為連續天數全天事件；重複同步自動更新，不產生重複事件 |
| 🔔 **LINE Bot 行前提醒** | GitHub Actions 每日定時檢查，提前 3 天與前 1 天自動推播 |

---

## 🏗️ 系統架構

```
前端（React + Vite + Tailwind CSS）
├── useTrips          核心配對引擎（拆票 → 排序 → 台灣邊界配對）
├── useTripOverrides  手動重組的持久化層（LocalStorage）
├── decoratedTrips    衍生資料層（isPast / totalCostTWD / isOpenJaw / ...）
└── UI Components
    ├── TripTimeline  趟次時間軸（純渲染，不做計算）
    ├── TicketList    購買清單管理
    └── TripCalendar  月曆視角

後端排程（GitHub Actions）
└── scripts/line-bot.js  Node.js → 讀 Drive → 推播 LINE
```

**資料流向**：LocalStorage ↔ 前端 ↔ (可選) Google Drive / Calendar / LINE

---

## 什麼是「反向票」？

反向票的核心邏輯是將兩張不同方向的來回票串接，在特定節慶或連假期間，外站出發的價格通常遠低於台灣出發。

- **第 1 套票（反向）**：日本 ➜ 台灣（今年 5 月）+ 台灣 ➜ 日本（今年 9 月）
- **第 2 套票（正向）**：台灣 ➜ 日本（今年 5 月）+ 日本 ➜ 台灣（今年 9 月）

**組合後的實際行程**：
- 趟次 1：台灣（5月去，正向）➜ 日本 ➜ 台灣（5月回，反向）
- 趟次 2：台灣（9月去，反向）➜ 日本 ➜ 台灣（9月回，正向）

本系統幫你清楚釐清這多段交錯的航程，並精算平均成本。

---

## 🛠️ 安裝與部署指南

全系統採用 **Serverless** 方案，不需自建伺服器。分為「前端授權」與「後端排程」兩部分。

### 第一步：申請 Google OAuth Client ID

前端需要 Google OAuth 金鑰來存取個人的 Drive 與 Calendar：

1. 進入 [Google Cloud Console](https://console.cloud.google.com/)，建立新專案。
2. **啟用 API（重要！）**：到「API 和服務 > 啟用 API」，啟用 **Google Drive API** 與 **Google Calendar API**。
3. **設定 OAuth 同意畫面**：類型選「外部 (External)」；在「測試使用者」加入你自己的 Google 信箱。
4. **建立憑證**：「憑證 > 建立憑證 > OAuth 用戶端 ID」，類型選「網頁應用程式」。
   在「已授權的 JavaScript 來源」加入：
   - `http://localhost:5173`（本地測試）
   - `https://你的GitHub帳號.github.io`（部署後）
5. 在專案根目錄建立 `.env.local`：
   ```bash
   VITE_GOOGLE_CLIENT_ID=你的_Google_OAuth_Client_ID
   ```

本地啟動：
```bash
npm install
npm run dev
```

---

### 第二步：部署到 GitHub Pages

此專案已內建自動部署流程（`.github/workflows/deploy.yml`）：

1. Push 到你自己的 GitHub 儲存庫。
2. 進入 `Settings > Secrets and variables > Actions`，點擊 `New repository secret`：
   - 名稱：`GOOGLE_CLIENT_ID`，值：第一步的 Client ID。
3. 未來 Push 到 `main` 分支即自動部署。

---

### 第三步：設定每日 LINE 推播機器人

`.github/workflows/line-bot-cron.yml` 每日定時執行（預設每早 8 點 UTC+8）。

在 `Settings > Secrets` 加入三個 Secret：

| Secret 名稱 | 說明 |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_CREDENTIALS` | Google 服務帳戶的 JSON 金鑰（完整 JSON 字串）。建立後需將 `reverse-tickets.json` 的 Drive 共用權限給該帳戶信箱（Viewer 即可）。 |
| `LINE_CHANNEL_ACCESS_TOKEN` | 到 [LINE Developers](https://developers.line.biz/) 建立 Messaging API Channel，發行長期 access token。 |
| `LINE_USER_ID` | 在同一 Channel 的 Basic Settings 底部找到，以 `U` 開頭的個人 User ID。 |

---

## 📁 專案結構

```
src/
├── App.jsx                  根元件；Google OAuth；資料層整合
├── components/
│   ├── Instructions.jsx     可折疊的操作說明面板
│   ├── TicketForm.jsx       新增/修改機票表單（含紅眼自動校正）
│   ├── TicketList.jsx       購買清單管理
│   ├── TripTimeline.jsx     趟次時間軸（純渲染）
│   └── TripCalendar.jsx     月曆視角
├── hooks/
│   ├── useTrips.js          核心配對引擎（Smart Grouping）
│   ├── useTripOverrides.js  手動重組持久化
│   └── useLocalStorage.js   型別安全的 localStorage Hook
└── utils/
    ├── dateHelpers.js       日期格式化與天數計算
    ├── googleSync.js        Drive / Calendar API 整合
    └── tripOverrides.js     手動 override 邏輯

scripts/
└── line-bot.js              GitHub Actions 排程腳本
```

---

## 授權條款

MIT License
