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
export function parseMapLinks(text) {
    if (!text || typeof text !== 'string') return [];

    const results = [];
    const lines = text.split(/[\r\n]+/);

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        // 1. Google Maps: /place/(Name)/@(lat),(lng)
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

        // 2. Google Maps query 帶經緯度: ?q=(lat),(lng) 或 ?query=(lat),(lng)
        const gQueryMatch = line.match(/[?&](?:q|query)=(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (gQueryMatch) {
            results.push({
                name: `Google Maps 地標 (${gQueryMatch[1]}, ${gQueryMatch[2]})`,
                lat: parseFloat(gQueryMatch[1]),
                lng: parseFloat(gQueryMatch[2]),
                source: 'google_maps',
                originalUrl: line
            });
            continue;
        }

        // 3. 純 Google Maps 視角坐標: @(lat),(lng),
        const gAtCoordMatch = line.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (gAtCoordMatch) {
            results.push({
                name: `Google Maps 視角坐標`,
                lat: parseFloat(gAtCoordMatch[1]),
                lng: parseFloat(gAtCoordMatch[2]),
                source: 'google_maps',
                originalUrl: line
            });
            continue;
        }

        // 4. Naver Maps 連結: map.naver.com 含有經緯度 (lng,lat 或 lat,lng)
        const naverMatch = line.match(/naver\.com\/.*?lng=(-?\d+\.\d+).*?lat=(-?\d+\.\d+)/) ||
                           line.match(/naver\.com\/.*?lat=(-?\d+\.\d+).*?lng=(-?\d+\.\d+)/);
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

        // 5. 純經緯度數字輸入: "25.033964, 121.564472" 或 "25.033964 121.564472"
        const rawCoordsMatch = line.match(/^(-?\d{1,3}\.\d+)[,\s]+(-?\d{1,3}\.\d+)$/);
        if (rawCoordsMatch) {
            const lat = parseFloat(rawCoordsMatch[1]);
            const lng = parseFloat(rawCoordsMatch[2]);
            if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                results.push({
                    name: `經緯度座標 (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
                    lat,
                    lng,
                    source: 'raw_coords'
                });
            }
        }
    }

    return results;
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
