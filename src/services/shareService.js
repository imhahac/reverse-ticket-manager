/**
 * shareService.js ── 唯讀行程分享服務
 *
 * 透過 Cloudflare Worker 的 KV 儲存，讓使用者可以將行程分享給他人唯讀瀏覽。
 * 需要設定 VITE_FLIGHT_PROXY_URL（Worker 網址）才能運作。
 */

const PROXY_BASE = import.meta.env.VITE_FLIGHT_PROXY_URL || '';

/**
 * 将行程快照发送到 Worker，儲存至 KV，回傳 UUID。
 * @param {Object} snapshot - { itinerary, tripLabels, hotels, activities }
 * @returns {Promise<string>} 分享 UUID
 */
export async function createShareSnapshot(snapshot) {
    if (!PROXY_BASE) {
        throw new Error('尚未設定 VITE_FLIGHT_PROXY_URL，無法建立分享連結。');
    }

    const res = await fetch(`${PROXY_BASE}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshot),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `分享失敗 (${res.status})`);
    }

    const data = await res.json();
    return data.id; // UUID
}

/**
 * 從 Worker KV 讀取分享快照。
 * @param {string} id - 分享 UUID
 * @returns {Promise<Object>} 行程快照
 */
export async function fetchShareSnapshot(id) {
    if (!PROXY_BASE) {
        throw new Error('尚未設定 VITE_FLIGHT_PROXY_URL，無法讀取分享行程。');
    }

    const res = await fetch(`${PROXY_BASE}/share/${id}`);
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `讀取失敗 (${res.status})`);
    }

    return res.json();
}
