# 航班反向票購買管理系統 (Reverse Ticket Manager) v7.0

這是一個純前端的靜態網頁應用程式，專為喜愛利用「反向機票」策略節省費用、或是頻繁往返兩地，並需要整合「機票與住宿」複雜邏輯的旅客所設計。

系統能將多張不同方向的來回機票（正向票與反向票）自動解構，並依照時間軸重新配對成你實際出發的飛行「趟次」，清楚顯示每一趟的機票、飯店與每日平均成本 (CP 值)，並具備極致的離線穩定性與自動備援機制。

## 線上 Demo

[https://imhahac.github.io/reverse-ticket-manager/](https://imhahac.github.io/reverse-ticket-manager/)

---

## 🌟 核心功能 (v7.0)

| 功能 | 說明 |
|---|---|
| 🎟️ **機票訂單管理** | 支援正/反/單程票。支援多幣別 (TWD/JPY/USD) 即時匯率計算。 |
| ⚡ **即時航班自動帶入**| 內建 AviationStack 與 AirLabs 的雙引擎備援 API。輸入航班號後，一鍵自動抓取起降時間（含紅眼航班自動 +1 天判斷）並快取 7 天。 |
| ✈️ **智慧趟次配對** | 以台灣機場為邊界，自動配對出門、回程趟次；完美支援外站轉機、不同點進出 (Open-Jaw)。 |
| 🏨 **住宿防呆與整合** | 可管理全球飯店清單。若趟次內住宿日期有「缺口」或「重疊」，系統會自動紅字警告。 |
| 📊 **預算深度分析** | 首頁 Dashboard 自動剖析「機票 / 住宿佔比」，統整未來待出行、歷史已實現、未配對沉沒成本。每趟行程皆動態計算「每日平均花費 (CP值)」。 |
| 🛡️ **核彈級資料防護** | 全局 React Error Boundary 保護，遭遇極端資料毀損時，系統不僅不會死當白畫面，更能優雅導向「安全模式介面」供一鍵重設。支援跨舊版 iOS 瀏覽器 (ES2015 Target)。 |
| ☁️ **全客戶端運行** | 100% 離線優先架構 (LocalStorage)。點擊右上角可授權將資料備份至個人 Google Drive。 |
| 📅 **Google 日曆智慧推送**| 機票精準同步時分；跨日住宿自動轉為「連續多天全天事件」並自動清理過期行程。 |
| 🔍 **全局智慧搜尋** | 頂端可快速過濾機場代碼 (如 NRT)、航班、飯店關鍵字或自訂的 Trip 標籤。 |

---

## 什麼是「反向票」？

反向票的核心邏輯是將兩張不同方向的來回票串接，在特定節慶期間，外站出發的機率通常遠低於台灣出發。

- **第 1 套票（反向）**：日本 ➜ 台灣（今年 5 月）+ 台灣 ➜ 日本（今年 9 月）
- **第 2 套票（正向）**：台灣 ➜ 日本（今年 5 月）+ 日本 ➜ 台灣（今年 9 月）

**組合後的實際行程**：
- 趟次 1：台灣（5月去，正向）➜ 日本 ➜ 台灣（5月回，反向）
- 趟次 2：台灣（9月去，反向）➜ 日本 ➜ 台灣（9月回，正向）

本系統幫你清楚釐清這多段交錯的航程，並精算平均成本加總。

---

## 🏗️ 系統架構

```
前端 (React + Vite + Tailwind CSS)
├── 數據匯流 (useLocalStorage)
│   ├── Tickets (機票流) ──>【useTrips】拆票 → 排序 → 台灣邊界配對成 "Trips"
│   └── Hotels (住宿流) ──>【useHotels】 CRUD 與衍生屬性
│
├── 衍生計算層 (useMemo)
│   ├── displayTrips      套用手動重組 (Overrides)
│   ├── decoratedTrips    計算航班成本、總天數、Open-Jaw 判定
│   └── itinerary         【useItinerary】注入 matchedHotels 與住宿警告
│
└── 呈現層 (UI & Routing)
        全局 ErrorBoundary 守護渲染安全
        Dashboard / TripTimeline / TicketList / HotelList / TripCalendar
```

**資料流向**：本機 localStorage ↔ 前端 ↔ Google Drive / Calendar / AviationStack (API)

---

## 🛠️ 安裝與部署指南

全系統採用 **Serverless** 方案，不需自建後端。

### 第一步：申請 Google OAuth & 外部 API 金鑰

1. **Google OAuth**：於 [Google Cloud Console](https://console.cloud.google.com/) 建立專案，啟用 Drive / Calendar API，並建立 OAuth Web Client 憑證。
2. **航班 API (可選但推薦)**：註冊 [AviationStack](https://aviationstack.com/) 或 [AirLabs](https://airlabs.co/) 取得免費 API Key 用於航班自動帶入。
3. **Google Service Account（LINE Bot 每日推播用）**：
   - 在 [Google Cloud Console](https://console.cloud.google.com/) 的同一專案中，前往「IAM 與管理員」→「服務帳戶」，建立新的服務帳戶。
   - 建立後，選擇「金鑰」→「新增金鑰」→「JSON 格式」，下載金鑰檔案。
   - 將下載到的 **JSON 金鑰內容**（整份複製）存入 GitHub Secrets 的 `GOOGLE_SERVICE_ACCOUNT_CREDENTIALS`。
   - 回到你的 **Google Drive**，找到系統備份的資料檔案，對它按右鍵→「共用」，將該服務帳戶的 Email 加入，給予「檢視者」權限，讓 cron 腳本能讀取雲端資料。

在專案根目錄建立 `.env.local` 供本機開發：
```bash
VITE_GOOGLE_CLIENT_ID=你的_Google_OAuth_Client_ID
VITE_AVIATIONSTACK_API_KEY=你的_AviationStack_Key
VITE_AIRLABS_API_KEY=你的_AirLabs_Key
```

### 第二步：安裝與啟動
```bash
npm install
npm run dev
```

### 第三步：部署到 GitHub Pages

此專案已內建自動部署流程（`.github/workflows/deploy.yml`）：
1. 進入 GitHub `Settings > Secrets and variables > Actions`，建立 Secrets：
   - `GOOGLE_CLIENT_ID`
   - `AVIATIONSTACK_API_KEY` (可選)
   - `AIRLABS_API_KEY` (可選)
2. 未來只要 Push 到 `main` 分支，系統即自動編譯 (Target: ES2015 確保舊手機相容) 並更新至 `gh-pages` 分支。

### 第四步：設定 LINE Bot 每日推播 (`.github/workflows/line-bot-cron.yml`)

系統內建每日自動通知行程的 cron 工作流程，需在 GitHub Secrets 中額外設定：

| Secret 名稱 | 說明 |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_CREDENTIALS` | Google 服務帳戶 JSON 金鑰（整份內容貼上）。需已對 Drive 備份檔案設定共用給此帳戶。 |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Messaging API 的 Channel Access Token |
| `LINE_USER_ID` | 推播目標的 LINE User ID |

---


## 📁 專案重點模組

- `src/ErrorBoundary.jsx`: 攔截所有不可預期之渲染崩潰，提供一鍵清除資料重設功能。
- `src/components/TicketForm.jsx`: 內建 API Fallback 代理查詢與本地七天快取。
- `src/hooks/useItinerary.js`: 負責媒合「航班時間」與「飯店 Check-in/out」，實現智慧缺口警告。
- `src/utils/googleSync.js`: 無縫對接個人的 Drive JSON 存檔與 Calendar 推播。

---

## 授權條款

MIT License
