/**
 * Cloudflare Worker for Reverse Ticket Manager (RTM)
 *
 * ── 功能一：航班 API 代理 ──────────────────────────────────────────────────────
 * GET /?api=aviationstack&flight=CI101
 * GET /?api=airlabs&flight=CI101
 *
 * ── 功能二：唯讀行程分享 (KV) ──────────────────────────────────────────────────
 * POST /share        Body: JSON 行程快照 → 回傳 { id: UUID }
 * GET  /share/:id   → 回傳之前存入的行程快照 JSON
 *
 * 環境變數（Secrets）：
 *   AVIATIONSTACK_API_KEY  - AviationStack 金鑰
 *   AIRLABS_API_KEY        - AirLabs 金鑰
 *
 * KV Namespace 綁定（wrangler.toml）：
 *   SHARED_TRIPS  - 用於分享功能的 KV namespace
 *
 * 部署步驟：
 * 1. 建立 KV namespace: wrangler kv:namespace create SHARED_TRIPS
 * 2. 複製輸出的 id 填入 wrangler.toml（見同目錄的 wrangler.toml）
 * 3. wrangler secret put AVIATIONSTACK_API_KEY
 *    wrangler secret put AIRLABS_API_KEY
 * 4. wrangler deploy
 */

function uuid() {
  return crypto.randomUUID();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "*";

    const corsHeaders = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
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
      try {
        const body = await request.text();
        // 驗證是合法 JSON
        JSON.parse(body);

        const id = uuid();
        // 有效期 30 天（秒數）
        await env.SHARED_TRIPS.put(id, body, { expirationTtl: 60 * 60 * 24 * 30 });
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
      if (!id) return json({ error: "缺少 id" }, 400);

      const data = await env.SHARED_TRIPS.get(id);
      if (!data) return json({ error: "分享連結已過期或不存在" }, 404);
      return new Response(data, {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // ── 原有：航班 API 代理 ──────────────────────────────────────────────────
    const apiType = url.searchParams.get('api');
    const flightNo = url.searchParams.get('flight');

    if (!apiType || !flightNo) {
      return json({ error: "缺少必要的 'api' 或 'flight' 參數" }, 400);
    }

    let targetUrl = "";

    try {
      if (apiType === 'aviationstack') {
        if (!env.AVIATIONSTACK_API_KEY) throw new Error("Worker 環境變數遺失: AVIATIONSTACK_API_KEY");
        targetUrl = `http://api.aviationstack.com/v1/flights?access_key=${env.AVIATIONSTACK_API_KEY}&flight_iata=${flightNo}`;
      } else if (apiType === 'airlabs') {
        if (!env.AIRLABS_API_KEY) throw new Error("Worker 環境變數遺失: AIRLABS_API_KEY");
        targetUrl = `https://airlabs.co/api/v9/routes?api_key=${env.AIRLABS_API_KEY}&flight_iata=${flightNo}`;
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
