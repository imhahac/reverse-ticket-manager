/**
 * airportService.js
 * 離線機場資料庫服務：支援 7,917+ 個全球機場（涵蓋所有 IATA 機場），
 * 免 API Key 即可即時取得經緯度、IANA 本地時區 (如 Asia/Taipei) 與中英文地名。
 *
 * 採用非同步動態載入 (Dynamic Import)，不阻塞首頁 Initial Bundle。
 */

let airportsDataPromise = null;
let airportsMap = null;

export async function loadAirportsData() {
    if (airportsMap) return airportsMap;
    if (!airportsDataPromise) {
        airportsDataPromise = import('../data/airports.json').then((module) => {
            airportsMap = module.default || module;
            return airportsMap;
        });
    }
    return airportsDataPromise;
}

/**
 * 取得機場資訊
 * @param {string} code - 例如 "TPE" 或 "NRT" 或包含代碼的字串 "TPE 台北桃園"
 * @returns {Promise<{iata: string, name: string, city: string, country: string, lat: number, lng: number, tz: string, zh: string}|null>}
 */
export async function getAirport(code) {
    if (!code) return null;
    const cleanCode = (code.match(/^[A-Z]{3}/i)?.[0] || code.slice(0, 3)).toUpperCase();
    const data = await loadAirportsData();
    const item = data[cleanCode];
    if (!item) return null;

    return {
        iata: item.i,
        name: item.n,
        city: item.c,
        country: item.cc,
        lat: item.lat,
        lng: item.lon,
        tz: item.tz,
        zh: item.zh
    };
}

/**
 * 同步取得機場（若已載入），若尚未載入回傳 null
 */
export function getAirportSync(code) {
    if (!code || !airportsMap) return null;
    const cleanCode = (code.match(/^[A-Z]{3}/i)?.[0] || code.slice(0, 3)).toUpperCase();
    const item = airportsMap[cleanCode];
    if (!item) return null;
    return {
        iata: item.i,
        name: item.n,
        city: item.c,
        country: item.cc,
        lat: item.lat,
        lng: item.lon,
        tz: item.tz,
        zh: item.zh
    };
}

/**
 * 取得機場經緯度座標
 */
export async function getAirportCoords(code) {
    const ap = await getAirport(code);
    return ap ? { lat: ap.lat, lng: ap.lng } : null;
}

/**
 * 取得機場本地 IANA 時區
 */
export async function getAirportTimezone(code) {
    const ap = await getAirport(code);
    return ap ? ap.tz : 'UTC';
}

/**
 * 模糊搜尋機場（支援代碼、英文名、城市名、中文名）
 * @param {string} query
 * @param {number} limit
 */
export async function searchAirports(query, limit = 10) {
    if (!query || typeof query !== 'string') return [];
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const data = await loadAirportsData();
    const results = [];

    // 1. 精確符合 IATA 優先
    const upperQ = q.toUpperCase();
    if (data[upperQ]) {
        const item = data[upperQ];
        results.push({
            iata: item.i,
            name: item.n,
            city: item.c,
            country: item.cc,
            lat: item.lat,
            lng: item.lon,
            tz: item.tz,
            zh: item.zh
        });
    }

    for (const [iata, item] of Object.entries(data)) {
        if (results.length >= limit) break;
        if (iata === upperQ) continue; // 已加入

        const matchesIata = iata.toLowerCase().startsWith(q);
        const matchesZh = item.zh && item.zh.toLowerCase().includes(q);
        const matchesCity = item.c && item.c.toLowerCase().includes(q);
        const matchesName = item.n && item.n.toLowerCase().includes(q);

        if (matchesIata || matchesZh || matchesCity || matchesName) {
            results.push({
                iata: item.i,
                name: item.n,
                city: item.c,
                country: item.cc,
                lat: item.lat,
                lng: item.lon,
                tz: item.tz,
                zh: item.zh
            });
        }
    }

    return results;
}
