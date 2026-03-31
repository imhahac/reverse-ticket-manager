# ✈️ Reverse Ticket Manager (航班反向票購買管理系統)

這是一個 **100% Client-Side** 的靜態 React 網頁應用程式，專為喜愛利用「反向機票」、「外站出發」策略節省費用，或是頻繁往返多地的進階旅客所設計。

系統具備強大的「趟次自動拆解演算法」，能將您東拼西湊的多張單程票、傳統來回機票重新解構，並依照時間軸自動配對成您**實際出門到回家**的飛行「趟次 (Trips)」。

🔗 **[線上體驗 Demo](https://imhahac.github.io/reverse-ticket-manager/)**

---

## 🌟 核心功能說明

### 1. 🎟️ 智慧趟次配對演算 (Smart Grouping)
輸入任意獨立的機票，系統會以「台灣機場」為判斷基準點，自動識別並組合為合理的「出國到回國」趟次。
- 完美的支援外站轉機、多點進出 (Open-Jaw)
- 自動將跨日紅眼航班的抵達日修正為正確的當地住宿起點

### 2. 📊 預算與 CP 值儀表板 (Dashboard)
將「機票、住宿、活動」三大類別的花費視覺化，支援多幣別即時匯率換算。
- 將複雜的沈沒成本（Sunk Cost）獨立抓出
- 精準計算出每趟旅程的「每日平均花費 (CP值)」

### 3. 🗺️ 跨維度防呆 (地圖與排程校驗)
結合航班到達時間與住宿預定的**真實地理座標**。
- **地點防呆**：若系統發現您「降落關西，卻訂了關東的飯店」，距離超過 200km，會立刻給予警告。
- **排程防呆**：住宿時間缺口、重疊，或是航班時間衝突，皆會在列表上亮起紅燈警告。

### 4. ☁️ 全前端無縫 Google 整合
- **Drive 自動備份**：100% Client-Side，所有紀錄預設存於瀏覽器 LocalStorage。登入 Google 後，可一鍵加密打包 JSON 上傳至您個人的私人 Drive 做無縫備援。
- **Calendar 行事曆自動化**：點擊同步，自動將航班轉為**含時區設定**的跨國事件，住宿則完美對接全天連續事件。

---

## 📸 功能預覽 (Screenshots)

*(提示：請在此處替換為實際的 UI 截圖)*

- **儀表板分析**：  
  `![Dashboard Preview](./docs/images/dashboard.png)`
- **智慧行程地圖**：  
  `![Map Preview](./docs/images/map.png)`
- **一鍵 Google 行事曆同步**：  
  `![Calendar Sync](./docs/images/calendar-sync.png)`

---

## 🏗️ 系統架構概念 (System Architecture)

為確保在無後端情況下的穩定性與安全性，本專案在前端進行了深度的解耦設計：

### Context 單向數據流
```text
Data Context (CRUD) → Sync Context (雲端邏輯) → UI Context (彈窗/狀態) → Filter Context (純函數組裝與過濾)
```
- **核心解耦**：所有搜尋、過濾、地圖定位、與複雜行程重組邏輯皆抽離至 `FilterContext`，確保資料來源層 (`DataContext`) 的乾淨與無副作用。
- **統一錯誤處理**：全系統的所有攔截、提示、例外處理皆集中由 `constants/errors.js` 管理。

### Client-Side 防護 (Hardening)
- 若環境缺少關鍵變數 (`VITE_GOOGLE_CLIENT_ID`)，系統將拋出 ErrorOverlay 阻斷啟動。
- Google OAuth Token 具備主動過期偵測 (`tokens > 10 min` 即嘗試背景靜默換發，失敗則主動登出)。

---

## 🛠️ 開發與部署指南 (Deployment & Envs)

由於本系統是純前端架構 (Vite SPA)，所有的環境變數必須在「編譯期」透過 `.env` 或 CI/CD Secrets 注入。

### 環境變數列表 (Environment Variables)

| 變數名稱 | 必填 | 說明 |
|----------|------|------|
| `VITE_GOOGLE_CLIENT_ID` | ✅ **必備** | 啟用 Drive 備份與 Calendar 同步功能。若無會導致應用程式強制重組。 |
| `VITE_FLIGHT_PROXY_URL` | 🟢 推薦 | [重要！] 隱藏航班 API 用的 Cloudflare Worker 網址。見下方部署指南。 |
| `VITE_MAPBOX_API_KEY` | ✅ **必備** | 渲染核心地圖功能。 |
| `VITE_GOOGLE_MAPS_API_KEY` | 🟢 推薦 | Geocoding API (將文字地址轉為精確經緯度以利地圖防呆)。 |
| `VITE_AVIATIONSTACK_API_KEY` | ⚠️ 警告 | 若未設定 Proxy，此金鑰將以明文暴露給所有訪客，有盜刷風險！ |
| `VITE_AIRLABS_API_KEY` | ⚠️ 警告 | 同上。 |

### 🚀 部署流程

關於如何申請上述金鑰，並利用 **Github Actions** 與 **Cloudflare Workers** 達成**100% 安全無外洩零信任部署**，請務必參閱詳細的：
👉 **[部署與 API 安全設定指南 (deployment.md)](./deployment.md)**

---

## 授權條款
MIT License
