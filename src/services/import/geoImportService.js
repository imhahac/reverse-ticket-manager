/**
 * geoImportService.js
 * 純前端外部景點與軌跡匯入解析引擎：
 * 1. GPX (XML DOMParser 解析 <wpt> 與 <trkpt>)
 * 2. KML (XML DOMParser 解析 <Placemark> 與 <coordinates>)
 * 3. KMZ (JSZip 解壓縮 doc.kml 後呼叫 KML 解析器)
 * 4. Google Maps & Naver Maps 分享連結與經緯度智慧解析
 */

/**
 * 解析 GPX XML 字串為景點清單
 * @param {string} gpxText
 * @returns {Array<{ name: string, lat: number, lng: number, desc?: string, ele?: number }>}
 */
export function parseGpx(gpxText) {
    if (!gpxText || typeof gpxText !== 'string') return [];

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(gpxText, 'text/xml');

    // 檢查 XML 解析錯誤
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
        throw new Error('GPX 格式錯誤，無法解析 XML');
    }

    const places = [];

    // 1. 優先讀取獨立航點 <wpt>
    const waypoints = xmlDoc.querySelectorAll('wpt');
    waypoints.forEach(wpt => {
        const lat = parseFloat(wpt.getAttribute('lat'));
        const lon = parseFloat(wpt.getAttribute('lon'));
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
            const name = wpt.querySelector('name')?.textContent?.trim() || '未命名航點';
            const desc = wpt.querySelector('desc')?.textContent?.trim() || wpt.querySelector('cmt')?.textContent?.trim() || '';
            const ele = parseFloat(wpt.querySelector('ele')?.textContent) || null;

            places.push({
                name,
                lat,
                lng: lon,
                desc,
                ele,
                source: 'gpx_wpt'
            });
        }
    });

    // 2. 若無 <wpt>，嘗試抽取 <rtept> (路線點) 或間隔抽樣 <trkpt> (軌跡點)
    if (places.length === 0) {
        const routePoints = xmlDoc.querySelectorAll('rtept');
        routePoints.forEach((rpt, idx) => {
            const lat = parseFloat(rpt.getAttribute('lat'));
            const lon = parseFloat(rpt.getAttribute('lon'));
            if (Number.isFinite(lat) && Number.isFinite(lon)) {
                places.push({
                    name: rpt.querySelector('name')?.textContent?.trim() || `路線點 #${idx + 1}`,
                    lat,
                    lng: lon,
                    source: 'gpx_rtept'
                });
            }
        });
    }

    return places;
}

/**
 * 解析 KML XML 字串為景點清單
 * @param {string} kmlText
 * @returns {Array<{ name: string, lat: number, lng: number, desc?: string }>}
 */
export function parseKml(kmlText) {
    if (!kmlText || typeof kmlText !== 'string') return [];

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(kmlText, 'text/xml');

    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
        throw new Error('KML 格式錯誤，無法解析 XML');
    }

    const places = [];
    const placemarks = xmlDoc.querySelectorAll('Placemark');

    placemarks.forEach(pm => {
        const name = pm.querySelector('name')?.textContent?.trim() || '未命名地標';
        const desc = pm.querySelector('description')?.textContent?.trim() || '';
        const coordsText = pm.querySelector('coordinates')?.textContent?.trim() || '';

        if (coordsText) {
            // KML coordinates 格式: "lon,lat,ele" 或 "lon,lat"
            const firstCoord = coordsText.split(/\s+/)[0];
            const parts = firstCoord.split(',');
            if (parts.length >= 2) {
                const lon = parseFloat(parts[0]);
                const lat = parseFloat(parts[1]);
                const ele = parts.length > 2 ? parseFloat(parts[2]) : null;

                if (Number.isFinite(lat) && Number.isFinite(lon)) {
                    places.push({
                        name,
                        lat,
                        lng: lon,
                        desc,
                        ele: Number.isFinite(ele) ? ele : undefined,
                        source: 'kml'
                    });
                }
            }
        }
    });

    return places;
}

/**
 * 純前端解壓縮 KMZ 檔案並解析其中的 doc.kml
 * @param {File | Blob} file
 * @returns {Promise<Array<{ name: string, lat: number, lng: number, desc?: string }>>}
 */
export async function parseKmz(file) {
    const JSZipModule = await import('jszip');
    const JSZip = JSZipModule.default || JSZipModule;
    const zip = await JSZip.loadAsync(file);

    // 尋找主 kml 檔案 (通常是 doc.kml 或任意 .kml)
    let kmlFileName = Object.keys(zip.files).find(name => name.toLowerCase() === 'doc.kml');
    if (!kmlFileName) {
        kmlFileName = Object.keys(zip.files).find(name => name.toLowerCase().endsWith('.kml'));
    }

    if (!kmlFileName) {
        throw new Error('KMZ 封裝檔案中未找到有效的 .kml 地圖資料');
    }

    const kmlContent = await zip.files[kmlFileName].async('text');
    return parseKml(kmlContent);
}

/**
 * 智慧解析文字內容中的 Google Maps 與 Naver Maps 連結及純經緯度
 * 支援多行文字批次解析
 * @param {string} text
 * @returns {Array<{ name: string, lat: number, lng: number, source: string, originalUrl?: string }>}
 */
import { searchPlaces } from '../places/placeSearchService';

/**
 * 同步解析文字中直接包含經緯度之地圖連結或座標
 * @param {string} text
 * @returns {Array<{ name: string, lat: number, lng: number, source: string, originalUrl?: string }>}
 */
export function parseMapLinksSync(text) {
    if (!text || typeof text !== 'string') return [];

    const results = [];
    const lines = text.split(/[\r\n]+/);

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        // 1. Apple Maps 連結: maps.apple.com 含 ll=(lat),(lng)
        if (line.includes('maps.apple.com')) {
            const appleCoordMatch = line.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
            if (appleCoordMatch) {
                const qMatch = line.match(/[?&]q=([^&#]+)/);
                const name = qMatch ? decodeURIComponent(qMatch[1].replace(/\+/g, ' ')) : 'Apple Maps 地標';
                results.push({
                    name,
                    lat: parseFloat(appleCoordMatch[1]),
                    lng: parseFloat(appleCoordMatch[2]),
                    source: 'apple_maps',
                    originalUrl: line
                });
                continue;
            }
        }

        // 2. Naver Maps 連結: map.naver.com 含有經緯度 (lng,lat 或 lat,lng)
        if (line.includes('naver.com')) {
            const naverMatch = line.match(/lng=(-?\d+\.\d+).*?lat=(-?\d+\.\d+)/) ||
                               line.match(/lat=(-?\d+\.\d+).*?lng=(-?\d+\.\d+)/);
            if (naverMatch) {
                const lat = parseFloat(line.includes('lat=') ? line.match(/lat=(-?\d+\.\d+)/)[1] : naverMatch[2]);
                const lng = parseFloat(line.includes('lng=') ? line.match(/lng=(-?\d+\.\d+)/)[1] : naverMatch[1]);
                results.push({
                    name: 'Naver Map 景點',
                    lat,
                    lng,
                    source: 'naver_maps',
                    originalUrl: line
                });
                continue;
            }
        }

        // 3. Google Maps: /place/(Name)/@(lat),(lng)
        const gPlaceCoordMatch = line.match(/\/place\/([^/@?]+).*?@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (gPlaceCoordMatch) {
            const rawName = gPlaceCoordMatch[1].replace(/\+/g, ' ');
            const lat = parseFloat(gPlaceCoordMatch[2]);
            const lng = parseFloat(gPlaceCoordMatch[3]);
            results.push({
                name: decodeURIComponent(rawName),
                lat,
                lng,
                source: 'google_maps',
                originalUrl: line
            });
            continue;
        }

        // 3.1 Google Maps Protobuf 嵌入坐標: !3d(lat)!4d(lng)
        const gProtoMatch = line.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
        if (gProtoMatch) {
            const placeMatch = line.match(/\/place\/([^/@?]+)/);
            const rawName = placeMatch ? placeMatch[1].replace(/\+/g, ' ') : 'Google Maps 地標';
            results.push({
                name: decodeURIComponent(rawName),
                lat: parseFloat(gProtoMatch[1]),
                lng: parseFloat(gProtoMatch[2]),
                source: 'google_maps',
                originalUrl: line
            });
            continue;
        }

        // 3.2 Google Maps query / ll 帶經緯度: ?q=(lat),(lng) 或 ?query=(lat),(lng) 或 ?ll=(lat),(lng)
        const gQueryMatch = line.match(/[?&](?:q|query|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (gQueryMatch && (line.includes('google.com') || line.includes('goo.gl') || !line.startsWith('http'))) {
            const placeMatch = line.match(/\/place\/([^/@?]+)/);
            const rawName = placeMatch 
                ? decodeURIComponent(placeMatch[1].replace(/\+/g, ' '))
                : `Google Maps 地標 (${gQueryMatch[1]}, ${gQueryMatch[2]})`;
            results.push({
                name: rawName,
                lat: parseFloat(gQueryMatch[1]),
                lng: parseFloat(gQueryMatch[2]),
                source: 'google_maps',
                originalUrl: line
            });
            continue;
        }

        // 3.3 純 Google Maps 視角坐標: @(lat),(lng),
        const gAtCoordMatch = line.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (gAtCoordMatch && (line.includes('google.com') || line.includes('goo.gl'))) {
            const placeMatch = line.match(/\/place\/([^/@?]+)/);
            const rawName = placeMatch 
                ? decodeURIComponent(placeMatch[1].replace(/\+/g, ' '))
                : `Google Maps 視角坐標`;
            results.push({
                name: rawName,
                lat: parseFloat(gAtCoordMatch[1]),
                lng: parseFloat(gAtCoordMatch[2]),
                source: 'google_maps',
                originalUrl: line
            });
            continue;
        }

        // 6. 寬鬆純經緯度輸入 (支援 "(25.033964, 121.564472)"、"東京鐵塔 35.6586, 139.7454")
        const coordsRegex = /(?:^|[\s(,;])([+-]?\d{1,3}\.\d+)[,\s]+([+-]?\d{1,3}\.\d+)(?:[\s),;]|$)/;
        const coordsMatch = line.match(coordsRegex);
        if (coordsMatch) {
            const lat = parseFloat(coordsMatch[1]);
            const lng = parseFloat(coordsMatch[2]);
            if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                let placeName = line.replace(coordsRegex, ' ').replace(/[()，,]/g, '').trim();
                if (!placeName || placeName.length < 2) {
                    placeName = `經緯度座標 (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
                }
                results.push({
                    name: placeName,
                    lat,
                    lng,
                    source: 'raw_coords',
                    originalUrl: line
                });
                continue;
            }
        }
    }

    return results;
}

/**
 * 嘗試將 Google Maps 短網址 (maps.app.goo.gl 或 goo.gl/maps) 展開為完整包含地標名稱與經緯度的 URL
 * 優先使用本地/部署的 Cloudflare Worker 代理，備援使用 unshorten.me 公用 CORS API
 * @param {string} shortUrl
 * @returns {Promise<string|null>}
 */
export async function resolveGoogleMapsShortUrl(shortUrl) {
    if (!shortUrl || typeof shortUrl !== 'string') return null;

    // 1. 若環境有設定 Worker 代理，優先走邊緣節點展開
    const proxyBase = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FLIGHT_PROXY_URL) || '';
    if (proxyBase) {
        try {
            const workerUrl = `${proxyBase.replace(/\/+$/, '')}?api=unshorten&url=${encodeURIComponent(shortUrl)}`;
            const res = await fetch(workerUrl, { signal: AbortSignal.timeout(4000) });
            if (res.ok) {
                const data = await res.json();
                if (data && data.resolvedUrl) {
                    let cleaned = data.resolvedUrl;
                    if (cleaned.includes('continue=')) {
                        const m = cleaned.match(/continue=([^&]+)/);
                        if (m) cleaned = decodeURIComponent(m[1]);
                    }
                    return cleaned;
                }
            }
        } catch {
            // Worker 請求超時或未部署，繼續往下走備援
        }
    }

    // 2. 備援：使用公開支援 CORS 的 unshorten.me API
    try {
        const unshortenApi = `https://unshorten.me/json/${encodeURIComponent(shortUrl)}`;
        const res = await fetch(unshortenApi, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
            const data = await res.json();
            if (data && data.success && data.resolved_url) {
                let cleaned = data.resolved_url;
                if (cleaned.includes('continue=')) {
                    const m = cleaned.match(/continue=([^&]+)/);
                    if (m) cleaned = decodeURIComponent(m[1]);
                }
                return cleaned;
            }
        }
    } catch {
        // 忽略連線失敗
    }

    return null;
}

/**
 * 智慧非同步解析文字中的地圖連結、經緯度或景點名稱
 * 當輸入缺乏直接座標時，自動從分享文字萃取名稱並透過 Nominatim 聯網定位
 * @param {string} text
 * @returns {Promise<Array<{ name: string, lat: number, lng: number, source: string, originalUrl?: string, address?: string }>>}
 */
export async function parseMapLinks(text) {
    if (!text || typeof text !== 'string') return [];

    // 1. 先執行同步提取已知座標
    const directResults = parseMapLinksSync(text);

    // 2. 找出未直接匹配出座標但包含地名、短網址或分享連結的行
    const lines = text.split(/[\r\n]+/);
    const searchTasks = [];
    const shortUrlTasks = [];
    const directUrls = new Set(directResults.map(r => r.originalUrl).filter(Boolean));

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || directUrls.has(line)) continue;

        let placeName = '';
        const originalUrl = line;

        // 偵測 Google Maps 短網址 (maps.app.goo.gl 或 goo.gl/maps)
        const shortUrlMatch = line.match(/https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps)\/[A-Za-z0-9_-]+/i);

        // 模式 A: 手機 Google Maps 分享文字: 在 Google 地圖上查看「(名稱)」：https://...
        const shareTitleMatch = line.match(/(?:在\s*Google\s*地圖上)?查看[「『"“](.*?)[」』"”]/i) ||
                                line.match(/^[「『"“](.*?)[」』"”]/);
        if (shareTitleMatch) {
            placeName = shareTitleMatch[1].trim();
        } else {
            // 模式 B: (名稱) https://maps.app.goo.gl/... 或 https://goo.gl/maps/...
            const shortShareMatch = line.match(/^(.*?)\s+https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.com|www\.google\.com\/maps)/i);
            if (shortShareMatch && shortShareMatch[1].trim().length >= 2) {
                placeName = shortShareMatch[1].replace(/[「」『』"“”]/g, '').trim();
            }
        }

        // 模式 C: 若有短網址但無法直接從行內取得有效景點名稱，加入短網址還原排程
        if (!placeName && shortUrlMatch) {
            shortUrlTasks.push({ shortUrl: shortUrlMatch[0], originalLine: line });
            continue;
        }

        // 模式 D: Google Maps 搜尋或 Place 連結 (不含座標)
        if (!placeName && line.includes('google.com/maps')) {
            const searchParamMatch = line.match(/[?&]query=([^&#]+)/) ||
                                     line.match(/\/maps\/search\/([^/?&#]+)/);
            if (searchParamMatch) {
                placeName = decodeURIComponent(searchParamMatch[1].replace(/\+/g, ' ')).trim();
            } else {
                const placePathMatch = line.match(/\/maps\/place\/([^/@?&#]+)/);
                if (placePathMatch) {
                    placeName = decodeURIComponent(placePathMatch[1].replace(/\+/g, ' ')).trim();
                }
            }
        }

        // 模式 E: Apple Maps 搜尋連結
        if (!placeName && line.includes('maps.apple.com')) {
            const appleQMatch = line.match(/[?&]q=([^&#]+)/);
            if (appleQMatch) {
                placeName = decodeURIComponent(appleQMatch[1].replace(/\+/g, ' ')).trim();
            }
        }

        // 模式 F: 純景點名稱文字 (不含 http:// 或 https://，長度 2 ~ 40 字)
        if (!placeName && !line.includes('http://') && !line.includes('https://') && line.length >= 2 && line.length <= 40) {
            if (!/^[0-9\s,.-]+$/.test(line)) {
                placeName = line.replace(/^[0-9]+[.\-、\s]+/, '').trim();
            }
        }

        if (placeName && placeName.length >= 2) {
            searchTasks.push({ name: placeName, originalUrl });
        }
    }

    const resolvedResults = [...directResults];

    // 3. 處理短網址還原
    if (shortUrlTasks.length > 0) {
        const shortUrlPromises = shortUrlTasks.map(async task => {
            const expandedUrl = await resolveGoogleMapsShortUrl(task.shortUrl);
            if (expandedUrl) {
                // 將展開後的 URL 嘗試直接同步抽取
                const extracted = parseMapLinksSync(expandedUrl);
                if (extracted.length > 0) {
                    return extracted.map(item => ({
                        ...item,
                        originalUrl: task.originalLine
                    }));
                }
                // 若只拿到 place 路徑中的地名但無經緯度
                const placeMatch = expandedUrl.match(/\/place\/([^/@?&#]+)/);
                if (placeMatch) {
                    const fallbackName = decodeURIComponent(placeMatch[1].replace(/\+/g, ' ')).trim();
                    if (fallbackName) {
                        return [{ fallbackSearch: fallbackName, originalUrl: task.originalLine }];
                    }
                }
            }
            return null;
        });

        const shortUrlResults = await Promise.all(shortUrlPromises);
        shortUrlResults.flat().forEach(item => {
            if (!item) return;
            if (item.fallbackSearch) {
                searchTasks.push({ name: item.fallbackSearch, originalUrl: item.originalUrl });
            } else {
                resolvedResults.push(item);
            }
        });
    }

    // 4. 透過 Nominatim 聯網並行搜尋解析真實座標
    const searchedNames = new Set(resolvedResults.map(r => r.name.toLowerCase()));

    if (searchTasks.length > 0) {
        const uniqueTasks = [];
        for (const t of searchTasks) {
            if (!searchedNames.has(t.name.toLowerCase())) {
                searchedNames.add(t.name.toLowerCase());
                uniqueTasks.push(t);
            }
        }

        const searchPromises = uniqueTasks.slice(0, 10).map(async task => {
            try {
                const candidates = await searchPlaces(task.name);
                if (candidates && candidates.length > 0) {
                    const top = candidates[0];
                    return {
                        name: task.name,
                        lat: top.lat,
                        lng: top.lng,
                        address: top.address || top.displayName || '',
                        source: 'search_place',
                        originalUrl: task.originalUrl
                    };
                }
            } catch {
                // 忽略個別網路問題
            }
            return null;
        });

        const foundPlaces = await Promise.all(searchPromises);
        foundPlaces.forEach(p => {
            if (p) resolvedResults.push(p);
        });
    }

    return resolvedResults;
}

/**
 * 統一檔案匯入接口：依據副檔名解析 GPX, KML, KMZ
 * @param {File} file
 * @returns {Promise<Array<{ name: string, lat: number, lng: number, desc?: string }>>}
 */
export async function parseGeoFile(file) {
    if (!file) return [];
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.kmz')) {
        return parseKmz(file);
    }

    const text = await file.text();
    if (fileName.endsWith('.gpx')) {
        return parseGpx(text);
    } else if (fileName.endsWith('.kml')) {
        return parseKml(text);
    } else {
        throw new Error(`不支援的檔案格式：${file.name} (僅支援 .gpx, .kml, .kmz)`);
    }
}
