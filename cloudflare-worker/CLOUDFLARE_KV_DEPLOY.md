# Cloudflare Worker KV 唯讀分享功能 — 雲端佈署手冊

本手冊說明如何在 **Cloudflare 網頁 Dashboard** 進行完整的 KV 分享功能部署，**全程不需要使用本機命令列**。

---

## 前置條件

- 一個 Cloudflare 帳號（免費帳號即可）。
- 已佈署 RTM 的 Cloudflare Worker（即 `rtm-flight-proxy`）。
- 您的 GitHub Actions Secrets 已設定 `VITE_FLIGHT_PROXY_URL`。

---

## 步驟一：建立 KV Namespace

1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com)。
2. 從左側選單選擇 **Workers & Pages** → **KV**。
3. 點擊 **「Create a namespace」** 按鈕。
4. 在 **Name** 欄位填入 `SHARED_TRIPS`，點擊 **「Add」**。
5. 複製產生的 **Namespace ID**（格式類似 `a1b2c3d4e5f6...`）。

> [!IMPORTANT]
> 請妥善保管此 Namespace ID，後續步驟需要它。

---

## 步驟二：綁定 KV 到 Worker

1. 於 Cloudflare Dashboard 的左側選單，選擇 **Workers & Pages**。
2. 點擊您的 Worker 名稱（`rtm-flight-proxy`）。
3. 點擊上方的 **「Settings」** 標籤。
4. 向下捲動找到 **「Variables」** 區塊，再找到 **「KV Namespace Bindings」**。
5. 點擊 **「Add binding」**：
   - **Variable name**：填入 `SHARED_TRIPS`（必須完全一致！）
   - **KV namespace**：從下拉選單中選擇剛才建立的 `SHARED_TRIPS`。
6. 點擊 **「Save and deploy」**。

---

## 步驟三：部署更新後的 Worker 程式碼

> 本步驟是在 Cloudflare Dashboard 中更新 Worker 的程式碼。

1. 在您的 Worker 頁面，點擊 **「Edit Code」**（或 **「Quick Edit」**）。
2. 將 `cloudflare-worker/worker.js` 的完整內容貼上（這個版本已包含 `/share` 端點）。
3. 點擊右上角的 **「Save and deploy」**。

> [!TIP]
> 若您的 Worker 是透過 GitHub Actions 的 `wrangler publish` 自動部署的，只需提交程式碼變更到 GitHub，Actions 就會自動佈署到 Cloudflare。KV 綁定設定（Steps 1-2）只需手動在 Dashboard 完成一次。

---

## 步驟四：驗證功能是否正常

### 測試 POST /share

複製以下 `curl` 指令，替換 `<YOUR_WORKER_URL>`：

```bash
curl -X POST https://<YOUR_WORKER_URL>/share \
  -H "Content-Type: application/json" \
  -d '{"test": "hello"}'
```

**預期回應：**
```json
{ "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" }
```

### 測試 GET /share/:id

使用上一步回傳的 `id`：

```bash
curl https://<YOUR_WORKER_URL>/share/<UUID>
```

**預期回應：**
```json
{ "test": "hello" }
```

---

## 步驟五：設定前端環境變數

確認 GitHub Secrets 中的 `VITE_FLIGHT_PROXY_URL` 已設定為您的 Worker 完整網址（例如 `https://rtm-flight-proxy.your-account.workers.dev`）。

重新觸發 GitHub Actions 工作流程（或 push 一個 commit）以完成前端佈署。

---

## 分享連結說明

| 項目 | 說明 |
|---|---|
| **有效期** | 30 天 |
| **連結格式** | `https://your-domain/reverse-ticket-manager/?view=<UUID>` |
| **權限** | 唯讀，他人無法修改您的資料 |
| **儲存位置** | Cloudflare KV 全球邊緣節點（非您的個人裝置） |
| **費用** | Cloudflare KV 免費方案含每日 100,000 次讀取，足夠個人使用 |

> [!WARNING]
> 分享連結包含了您當下的行程快照，請不要分享給不信任的對象。連結過期後資料會自動從 KV 刪除。
