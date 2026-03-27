# 航班反向票購買管理系統 (Reverse Ticket Manager) v8.0

這是一個純前端的靜態網頁應用程式，專為喜愛利用「反向機票」策略節省費用、或是頻繁往返兩地，並需要整合「機票與住宿」複雜邏輯的旅客所設計。

系統能將多張不同方向的來回機票（正向票與反向票）自動解構，並依照時間軸重新配對成你實際出發的飛行「趟次」，清楚顯示每一趟的機票、飯店與每日平均成本 (CP 值)，並具備極致的離線穩定性與自動備援機制。

## 線上 Demo

[https://imhahac.github.io/reverse-ticket-manager/](https://imhahac.github.io/reverse-ticket-manager/)

---

## 🌟 核心功能 (v8.0)

| 功能 | 說明 |
|---|---|
| 🎟️ **機票訂單管理** | 支援正/反/單程票。支援多幣別 (TWD/JPY/USD) 即時匯率計算。 |
| ⚡ **智慧航班自動帶入** | 內建 AviationStack 與 AirLabs 雙引擎，並整合 **多重 Proxy (corsproxy.io / allorigins)** 備援，提升在 GitHub Pages 環境下的 API 穩定性。 |
| ✈️ **智慧趟次配對** | 以台灣機場為邊界，自動配對出門、回程趟次；完美支援外站轉機、不同點進出 (Open-Jaw) 與進階時間悖論校驗。 |
| 🏨 **住宿與活動防呆** | 可管理全球飯店及活動票卷。若趟次內住宿有「地點落差」或時間「重疊」，系統將根據核心座標資料庫自動警示。 |
| 📊 **預算深度分析** | Dashboard 自動剖析「機票 / 住宿 / 活動佔比」。每張來回票費用平均分給兩段航班，並動態計算每趟行程的「每日平均花費 (CP值)」。 |
| 🛡️ **系統配置與安全性** | 內建環境變數自動校驗 UI。提供全局 Error Boundary 保護，遭遇資料損毀時可進入「安全模式介面」一鍵重設。 |
| ☁️ **全客戶端運行** | 100% 離線優先架構 (LocalStorage)。支援授權備份至個人 Google Drive。 |
| 📅 **Google 日曆智慧推送**| 航班精準同步；飯店住宿轉為單一連續事件；支援活動票卷同步並自動處理 OAuth 靜默更新。 |
| 🔍 **全局智慧搜尋** | 頂端可快速過濾機場代碼 (如 NRT, LAX, CDG)、航班、飯店、活動關鍵字或自訂的 Trip 標籤。 |

---

## 🏗️ 系統架構

```
前端 (React + Vite + Tailwind CSS)
├── 基礎配置 (src/constants/config.js) ── 統一管理 Env 變數與 UI 警告
├── 數據持久化 (useLocalStorage)
│   ├── Tickets (機票) ──>【useTrips】拆票 → 排序 → 業務邏輯校驗 → 配對 Trips
│   ├── Hotels (住宿)  ──>【useHotels】 CRUD 與座標衍生屬性
│   └── Activities (活動)
│
├── 服務層 (Services / Utils)
│   ├── flightService     雙 API 引擎 + Multi-Proxy 請求轉發
│   ├── googleSync        Drive JSON 備份 + Calendar 事件推撥
│   └── entityUtils       封裝 Geocoding 與 UI 副作用的純函式
│
└── 呈現層 (UI Components)
        Dashboard / TripTimeline / TicketList / HotelList / TripCalendar
        PropTypes 完整型別驗證 (v8.0 強化)
```

---

## 🛠️ 安裝與部署指南

### 第一步：申請金鑰

1. **Google OAuth**：於 [Google Cloud Console](https://console.cloud.google.com/) 建立 OAuth Web Client 憑證，並取得 `VITE_GOOGLE_CLIENT_ID`。
2. **航班 API**：註冊 [AviationStack](https://aviationstack.com/) 或 [AirLabs](https://airlabs.co/) 取得 API Key。

### 第二步：部署到 GitHub Pages

系統已內建 `.github/workflows/deploy.yml`。請在 GitHub Repo 設定中的 `Settings > Secrets and variables > Actions` 建立以下 Secrets：

| Secret 名稱 | 說明 | 必填 |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | 是 |
| `AVIATIONSTACK_API_KEY` | AviationStack API Key | 否 |
| `AIRLABS_API_KEY` | AirLabs API Key | 否 |

### 第三步：設定 LINE Bot 每日推播 (`line-bot-cron.yml`)

若需 LINE 每日行程推播，需另外設定：
- `GOOGLE_SERVICE_ACCOUNT_CREDENTIALS`: Google 服務帳戶 JSON 金鑰。
- `LINE_CHANNEL_ACCESS_TOKEN`: LINE Messaging API Token。
- `LINE_USER_ID`: 接收端的 LINE ID。

---

## 授權條款
MIT License
