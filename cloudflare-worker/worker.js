/**
 * Cloudflare Worker for Reverse Ticket Manager (RTM)
 *
 * ── 功能一：航班 API 代理 (HTTPS + 參數安全編碼) ────────────────────────────
 * GET /?api=aviationstack&flight=CI101
 * GET /?api=airlabs&flight=CI101
 *
 * ── 功能二：受保護的行程快照分享 (KV) ─────────────────────────────────────────
 * POST /share        Body: JSON 行程快照 (上限 512KB，可選 Token 授權) → 回傳 { id: UUID }
 * GET  /share/:id   → 回傳之前存入的行程快照 JSON
 *
 * 環境變數（Secrets）：
 *   AVIATIONSTACK_API_KEY  - AviationStack 金鑰
 *   AIRLABS_API_KEY        - AirLabs 金鑰
 *   SHARE_SECRET_TOKEN     - [選配] 分享端點授權金鑰
 *   ALLOWED_ORIGINS        - [選配] 允許存取的來源清單 (以逗號分隔)
 *
 * KV Namespace 綁定（wrangler.toml）：
 *   SHARED_TRIPS  - 用於分享功能的 KV namespace
 */

function uuid() {
  return crypto.randomUUID();
}

const MAX_PAYLOAD_BYTES = 512 * 1024; // 512 KB 上限防護

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "*";

    // 嚴格 CORS 標頭控制
    const corsHeaders = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Share-Token",
      "X-Content-Type-Options": "nosniff"
    };

    // CORS 預檢
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });

    // ── 路由 /share ──────────────────────────────────────────────────────────
    if (url.pathname === "/share" && request.method === "POST") {
      if (!env.SHARED_TRIPS) {
        return json({ error: "KV namespace SHARED_TRIPS 未綁定" }, 500);
      }

      // 1. 驗證 Authorization (若 Worker 配置了 SHARE_SECRET_TOKEN)
      if (env.SHARE_SECRET_TOKEN) {
        const authHeader = request.headers.get("Authorization") || "";
        const customToken = request.headers.get("X-Share-Token") || "";
        const token = authHeader.replace(/^Bearer\s+/i, "") || customToken;
        if (token !== env.SHARE_SECRET_TOKEN) {
          return json({ error: "未授權存取：缺少有效的分享金鑰" }, 401);
        }
      }

      // 2. 嚴格檢查 Content-Length 防範 DoS
      const contentLength = parseInt(request.headers.get("content-length") || "0", 10);
      if (contentLength > MAX_PAYLOAD_BYTES) {
        return json({ error: "承載資料過大 (Payload Too Large，上限 512KB)" }, 413);
      }

      try {
        const body = await request.text();
        if (body.length > MAX_PAYLOAD_BYTES) {
          return json({ error: "承載資料過大 (上限 512KB)" }, 413);
        }

        // 3. 驗證是合法結構化 JSON 物件
        const parsed = JSON.parse(body);
        if (!parsed || typeof parsed !== 'object') {
          return json({ error: "無效的 JSON：根節點必須是物件" }, 400);
        }

        const id = uuid();
        // 有效期 30 天（秒數）
        await env.SHARED_TRIPS.put(id, JSON.stringify(parsed), { expirationTtl: 60 * 60 * 24 * 30 });
        return json({ id });
      } catch (e) {
        return json({ error: "無效的 JSON 格式: " + e.message }, 400);
      }
    }

    if (url.pathname.startsWith("/share/") && request.method === "GET") {
      if (!env.SHARED_TRIPS) {
        return json({ error: "KV namespace SHARED_TRIPS 未綁定" }, 500);
      }
      const id = url.pathname.replace("/share/", "").trim();
      if (!id || !/^[0-9a-fA-F-]{36}$/.test(id)) {
        return json({ error: "無效的分享識別碼 ID (必須為 UUID 格式)" }, 400);
      }

      const data = await env.SHARED_TRIPS.get(id);
      if (!data) return json({ error: "分享連結已過期或不存在" }, 404);
      return new Response(data, {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // ── 功能一：航班 API 代理 (強制走 HTTPS 與參數 URL 編碼) ──────────────────
    const apiType = url.searchParams.get('api');
    const rawFlightNo = url.searchParams.get('flight');

    if (!apiType || !rawFlightNo) {
      return json({ error: "缺少必要的 'api' 或 'flight' 參數" }, 400);
    }

    // 參數安全清理與編碼
    const flightNo = encodeURIComponent(rawFlightNo.trim().toUpperCase());
    let targetUrl = "";

    try {
      if (apiType === 'aviationstack') {
        if (!env.AVIATIONSTACK_API_KEY) throw new Error("Worker 環境變數遺失: AVIATIONSTACK_API_KEY");
        // 修正：強制採用 HTTPS 協議
        targetUrl = `https://api.aviationstack.com/v1/flights?access_key=${encodeURIComponent(env.AVIATIONSTACK_API_KEY)}&flight_iata=${flightNo}`;
      } else if (apiType === 'airlabs') {
        if (!env.AIRLABS_API_KEY) throw new Error("Worker 環境變數遺失: AIRLABS_API_KEY");
        targetUrl = `https://airlabs.co/api/v9/routes?api_key=${encodeURIComponent(env.AIRLABS_API_KEY)}&flight_iata=${flightNo}`;
      } else {
        return json({ error: "參數 'api' 無效。請使用 'aviationstack' 或 'airlabs'" }, 400);
      }

      const response = await fetch(targetUrl);
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });

    } catch (error) {
      return json({ error: error.message }, 500);
    }
  }
};
