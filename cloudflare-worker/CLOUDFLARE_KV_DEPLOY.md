# Cloudflare Worker KV 唯讀分享功能 — 佈署手冊

本手冊提供兩條路徑：
- **路徑 A：GitHub 自動化部署 (推薦)** — 透過 CI/CD 自動替換 ID 並部署，適合長期維護。
- **路徑 B：Cloudflare 手動部署** — 直接在網頁界面操作，適合快速測試或排錯。

---

## 共通步驟：建立 KV 空間 (不論哪種路徑都必須執行)

1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com)。
2. 於左側選單選擇 **Workers & Pages** → **KV**。
3. 點擊 **Create a namespace**。
4. **Name**: 輸入 `SHARED_TRIPS` (或其他你偏好的名稱)。
5. **複製 Namespace ID** (格式類似 `a1b2c3d4e5f6...`)。

---

## 🚀 路徑 A：GitHub 自動化部署 (推薦做法)

此做法利用 GitHub Actions 自動將金鑰注入並發佈 Worker。

### 1. GitHub 變數設定
請至 GitHub 儲存庫的 **Settings** -> **Secrets and variables** -> **Actions**：

- **Variables (變數)**：
  - `SHARED_TRIPS_KV_ID`: 填入你在共通步驟獲得的 **KV ID**。
  - `VITE_FLIGHT_PROXY_URL`: 填入你的 Worker 網址 (例如 `https://flight-api-proxy.your-account.workers.dev`)。

- **Secrets (機密)**：
  - `CLOUDFLARE_API_TOKEN`: 具備 Workers 編輯權限的 API Token。

#### 🔑 如何取得 CLOUDFLARE_API_TOKEN？
1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com)。
2. 點擊右上角的人像圖示，選擇 **My Profile** (我的設定)。
3. 在左側選單選擇 **API Tokens**。
4. 點擊 **Create Token**。
5. 找到 **Edit Cloudflare Workers** 模板，點擊 **Use template**。
6. 在 **Permissions** 區塊確認已有 `Workers Scripts: Edit` 等權限（預設已帶入）。
7. 在 **Account Resources** 選擇你的帳號。
8. 在 **Zone Resources** 選擇 **All zones** (或指定你的網域)。
9. 點擊 **Continue to summary**，最後點擊 **Create Token**。
10. **複製產生的 Token**（注意：它只會顯示一次！），將其填入 GitHub 的 `CLOUDFLARE_API_TOKEN` Secret 中。

### 2. 運作原理
- 本機端的 `wrangler.toml` 檔案中使用 `id = "__KV_ID__"` 作為佔位符。
- 當代碼推送到 GitHub 時，`.github/workflows/deploy.yml` 會動態執行 `sed` 指令將 `__KV_ID__` 替換為你在 GitHub 設定的真實 ID，然後執行部署。

### 3. 如何執行
- 確保所有檔案已 `git commit` 並 `push` 到 `main` 分支。
- GitHub Actions 會自動完成剩下的工作。

---

## 🛠️ 路徑 B：Cloudflare 手動部署 (快速測試 / 檢查用)

如果你想直接在瀏覽器上操作，或不希望透過 CI/CD 處理 Worker：

### 1. 手動綁定 KV
1. 在 Cloudflare 面板進入你的 Worker (`flight-api-proxy`)。
2. 點擊 **Settings** -> **Variables**。
3. 找到 **KV Namespace Bindings** 並點擊 **Add binding**：
   - **Variable name**: 必須輸入 `SHARED_TRIPS`。
   - **KV namespace**: 選擇你剛建立的空間。
4. 點擊 **Save and deploy**。

### 2. 手動貼上程式碼
1. 進入該 Worker 的 **Quick Edit** 模式。
2. 開啟專案中的 `cloudflare-worker/worker.js`，複製全部代碼。
3. 貼上到編輯器中。
4. 點擊 **Save and deploy**。

---

## 🔍 驗證與排錯

### 測試功能
你可以透過 `curl` 測試 Worker 是否能與 KV 溝通：

```bash
# 測試儲存 (POST)
curl -X POST https://<YOUR_WORKER_URL>/share -H "Content-Type: application/json" -d '{"test": "ok"}'

# 測試讀取 (GET)
curl https://<YOUR_WORKER_URL>/share/<回傳的ID>
```

### 常見問題
- **HTTP 500 錯誤**：通常是因為 **Variable name** 沒有設定為 `SHARED_TRIPS`（大小寫必須完全一致）。
- **分享按鈕顯示 🔒**：請檢查前端環境變數 `VITE_FLIGHT_PROXY_URL` 是否有正確填入 Worker 的網址。

---

## 分享機制說明

| 項目 | 說明 |
|---|---|
| **有效期** | 30 天 (過期後 KV 會自動刪除該筆資料) |
| **連結格式** | `https://your-domain/reverse-ticket-manager/?view=<UUID>` |
| **安全性** | 唯讀存取。這是一個行程的「快照」，即使之後你修改了本地資料，已分享的連結內容不會變動。 |
