/**
 * Cloudflare Worker for Reverse Ticket Manager (RTM) Flight API Proxy
 * 
 * 這是一個將 AviationStack 與 AirLabs 的 API 呼叫安全封裝在 Serverless 環境的代理程式，
 * 避免將 `VITE_AVIATIONSTACK_API_KEY` 等會扣額度的金鑰直接寫在 GitHub Pages 前端。
 *
 * 部署步驟：
 * 1. 安裝 Wrangler: `npm install -g wrangler`
 * 2. 初始化防護金鑰: 
 *    `wrangler secret put AVIATIONSTACK_API_KEY`
 *    `wrangler secret put AIRLABS_API_KEY`
 * 3. 部署上線: `wrangler deploy`
 * 4. 將產生的 Worker URL 填入 RTM Github Secrets 的 `VITE_FLIGHT_PROXY_URL` 中。
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "*";
    
    // 如果您想嚴格限制只有您的 GitHub Pages 網域可以呼叫，請取消下方註解並修改網域
    /*
    const allowedOrigins = ["https://your_github_username.github.io", "http://localhost:5173", "http://localhost:4173"];
    if (!allowedOrigins.includes(origin) && origin !== "*") {
      return new Response("Forbidden: Invalid Origin", { status: 403 });
    }
    */

    const corsHeaders = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    // 處理 CORS 預檢請求
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // 取得查詢參數
    const apiType = url.searchParams.get('api');      // 'aviationstack' 或 'airlabs'
    const flightNo = url.searchParams.get('flight');  // 航班編號，例如 'CI101'
    
    if (!apiType || !flightNo) {
      return new Response(JSON.stringify({ error: "缺少必要的 'api' 或 'flight' 參數" }), { 
        status: 400, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      });
    }

    let targetUrl = "";

    try {
      if (apiType === 'aviationstack') {
        if (!env.AVIATIONSTACK_API_KEY) throw new Error("Worker 環境變數遺失: AVIATIONSTACK_API_KEY");
        // AviationStack 免費版只支援 HTTP
        targetUrl = `http://api.aviationstack.com/v1/flights?access_key=${env.AVIATIONSTACK_API_KEY}&flight_iata=${flightNo}`;
      } else if (apiType === 'airlabs') {
        if (!env.AIRLABS_API_KEY) throw new Error("Worker 環境變數遺失: AIRLABS_API_KEY");
        targetUrl = `https://airlabs.co/api/v9/routes?api_key=${env.AIRLABS_API_KEY}&flight_iata=${flightNo}`;
      } else {
        return new Response(JSON.stringify({ error: "參數 'api' 無效。請使用 'aviationstack' 或 'airlabs'" }), { 
          status: 400, 
          headers: { "Content-Type": "application/json", ...corsHeaders } 
        });
      }

      // 替前端送出真實請求
      const response = await fetch(targetUrl);
      const data = await response.json();

      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      });
    }
  }
};
