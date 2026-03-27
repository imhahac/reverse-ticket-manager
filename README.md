# ✈️ 航班反向票購買管理系統 (Reverse Ticket Manager) v8.0

這是一個純前端的靜態 React 網頁應用程式，專為喜愛利用「反向機票」策略節省費用，或是頻繁往返兩地並需要整合「機票、住宿與活動票卷」複雜邏輯的進階旅客所設計。

系統具備強大的演算法，能將您東拼西湊的多張「單程票」、「來回機票」自動解構，依照時間軸重新配對成您**實際出門到回家**的飛行「趟次 (Trips)」。搭配住宿與活動管理，幫助您無痛防呆，清楚預覽每一趟旅程的總成本與時間線。

🔗 **[線上體驗 Demo](https://imhahac.github.io/reverse-ticket-manager/)**

---

## 🌟 核心功能亮點 (v8.0)

- 🎟️ **智慧趟次配對演算**：輸入任意機票，系統以台灣機場 (TPE, TSA, KHH, RMQ) 為基準出發地，自動為您計算趟次。完美支援外站轉機、不同點進出 (Open-Jaw) 與進階時間防呆校驗。
- 🏩 **跨維度行程防呆 (Geolocation & Overlap Checks)**：結合航班到達時間與住宿/活動的真實經緯度，當發現「地點落差巨大」(例如東京飛到福岡，卻訂了札幌的飯店) 或「活動時間重疊」，會立刻在行事曆與地圖上標示紅燈警告。
- ⚡ **航班時刻自動爬取 (Auto-Fill)**：雙引擎 (`AviationStack` & `AirLabs`) 整合，輸入航班代碼自動抓取確切出發與抵達時間。內建 Multi-Proxy 反代機制，大幅減少被跨域阻擋的可能。
- 📊 **預算儀表板 (Dashboard)**：即時視覺化機票、住宿、活動的花費佔比，並精準計算該趟旅程的「每日平均花費 (CP值)」。
- ☁️ **無縫 Google 生態整合**：
  - **Drive 備份**：完全支援個人 Google Drive 雲端上傳與載入，免除手動匯出的麻煩。
  - **Calendar 推播**：一鍵將航班轉換為 Calendar 事件，並自動將「飯店連住」轉為全天事件，不怕漏掉行程。

---

## 🏗️ 系統架構與技術棧

此專案為純前端架構 (100% Client-Side)，以最大化隱私與靜態網頁可攜性：

- **核心**：`React 18` + `Vite`
- **樣式**：`Tailwind CSS` + `Lucide React` (Icon)
- **地圖與定位**：`Mapbox GL JS` + `Google Maps Geocoding API`
- **狀態管理**：自建 `useLocalStorage` 與各類實體 `useEntityManager` Custom Hooks。
- **架構特點**：在 v8 編構中進行了大幅模組化 (Modularization)，將大型 UI 拆分為獨立的 Component (如 `TicketForm` 提取 `FlightSegmentInput`)，並將 CRUD 邏輯封裝，極大化提升開發與擴充體驗。

---

## 🛠️ 本地開發與部署指南

### 第一步：申請第三方金鑰

您必須申請以下免費金鑰才能驅動完整的地圖與同步功能：
1. **Google OAuth Client ID**：於 [Google Cloud Console](https://console.cloud.google.com/) 建立 Web Client，並啟用 `Drive API` 與 `Calendar API`。
2. **Google Maps API Key**：啟用 `Geocoding API` 用於地址轉座標。
3. **Mapbox API Key**：用於渲染世界地圖。
4. **航班查詢 API (選配)**：[AviationStack](https://aviationstack.com/) 或 [AirLabs](https://airlabs.co/)。

### 第二步：建立本地 `.env`
在專案根目錄建立 `.env.local` 檔案：
```env
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_key
VITE_MAPBOX_API_KEY=your_mapbox_key

# 航班搜群 API (此為危險操作，請詳閱下方安全通告)
VITE_AVIATIONSTACK_API_KEY=your_aviation_key
VITE_AIRLABS_API_KEY=your_airlabs_key
```

### 第三步：安裝與執行
```bash
npm install
npm run dev
```

---

## 🚨 嚴重安全性通告 (Security Warning)

由於本系統設計為**完全無後端**的架構（直接部屬在 GitHub Pages 等靜態伺服器上），這意味著 **寫在 `.env` 中所有以 `VITE_` 開頭的變數都會完全暴露給終端使用者**。

- **安全的金鑰**：`VITE_GOOGLE_CLIENT_ID` (這是設計給前端使用的，沒有風險)、`VITE_MAPBOX_API_KEY` (可在後台綁定 Domain 白名單，安全)。
- **危險的金鑰**：`VITE_AVIATIONSTACK_API_KEY` 與 `VITE_AIRLABS_API_KEY` 等航班查詢 API。若您將金鑰放上線，**任何人只要打開瀏覽器開發者工具 (F12)，都能輕易看到並盜用您的額度**。

### 🛡️ 強烈建議的防護方案 (Serverless Proxy)

請**絕對不要**在生產環境的靜態前端直接呼叫這些有額度限制或需付費的 API。
建議使用 **Cloudflare Workers** 或 **Vercel Functions** 架設一個極簡易的 Proxy 服務：

1. 開發一個 Cloudflare Worker 接收來自您前端的請求。
2. 在 Cloudflare 後台將 API Key 設為環境變數 (Secrets)。
3. Worker 收到請求後，**由 Worker 附帶金鑰去打 AviationStack**。
4. 將結果返回給前端。

這樣前端只會看到您自訂的 Proxy URL，而真正的 `AviationStack API Key` 會安全地藏在 Cloudflare 伺服器內。

---

## 授權條款
MIT License
