import { MAP } from '../constants/config';
import { logger } from './logger';

export const AIRPORT_COORDINATES = {
    'TPE': { lat: 25.0797, lng: 121.2342 }, // 桃園
    'TSA': { lat: 25.0697, lng: 121.5526 }, // 松山
    'KHH': { lat: 22.5771, lng: 120.3500 }, // 高雄
    'RMQ': { lat: 24.2646, lng: 120.6209 }, // 台中
    'NRT': { lat: 35.7647, lng: 140.3863 }, // 成田
    'HND': { lat: 35.5494, lng: 139.7798 }, // 羽田
    'KIX': { lat: 34.4320, lng: 135.2304 }, // 關西
    'ITM': { lat: 34.7855, lng: 135.4382 }, // 伊丹
    'NGO': { lat: 34.8583, lng: 136.8054 }, // 中部
    'CTS': { lat: 42.7849, lng: 141.6708 }, // 新千歲
    'HKD': { lat: 41.7735, lng: 140.8166 }, // 函館
    'FUK': { lat: 33.5859, lng: 130.4507 }, // 福岡
    'OKA': { lat: 26.1958, lng: 127.6525 }, // 沖繩
    'BKK': { lat: 13.6900, lng: 100.7501 }, // 蘇凡納布
    'DMK': { lat: 13.9126, lng: 100.6068 }, // 廊曼
    'CNX': { lat: 18.7668, lng: 98.9626 },  // 清邁
    'HKT': { lat: 8.1111,  lng: 98.3065 },  // 普吉島
    'SIN': { lat: 1.3644,  lng: 103.9915 }, // 樟宜
    'HKG': { lat: 22.3080, lng: 113.9185 }, // 香港
    'MFM': { lat: 22.1496, lng: 113.5915 }, // 澳門
    'ICN': { lat: 37.4602, lng: 126.4407 }, // 仁川
    'GMP': { lat: 37.5619, lng: 126.8010 }, // 金浦
    'PUS': { lat: 35.1732, lng: 128.9463 }, // 釜山
    'CJU': { lat: 33.5113, lng: 126.4930 }, // 濟州島
    // 歐美澳紐常見機場
    'LAX': { lat: 33.9416, lng: -118.4085 }, // 洛杉磯
    'SFO': { lat: 37.6213, lng: -122.3790 }, // 舊金山
    'JFK': { lat: 40.6413, lng: -73.7781 },  // 紐約甘迺迪
    'SEA': { lat: 47.4502, lng: -122.3088 }, // 西雅圖
    'YVR': { lat: 49.1967, lng: -123.1815 }, // 溫哥華
    'LHR': { lat: 51.4700, lng: -0.4543 },   // 倫敦希斯洛
    'CDG': { lat: 49.0097, lng: 2.5479 },    // 巴黎戴高樂
    'FRA': { lat: 50.0379, lng: 8.5622 },    // 法蘭克福
    'AMS': { lat: 52.3105, lng: 4.7683 },    // 阿姆斯特丹
    'DXB': { lat: 25.2532, lng: 55.3657 },   // 杜拜
    'SYD': { lat: -33.9399, lng: 151.1753 }, // 雪梨
    'MEL': { lat: -37.6690, lng: 144.8410 }, // 墨爾本
    'AKL': { lat: -38.0036, lng: 174.7930 }  // 奧克蘭
};

/**
 * 計算兩組經緯度之間的球面距離 (Haversine formula)
 * 
 * 🎨 業務規則解釋:
 * - 我們使用 200km 作為「地點不匹配」的警戒線。
 * - 理由：大多數大型國際機場（如 NRT 到 東京市區）距離約在 60-80km 內。
 * - 若飯店距離機場超過 200km（例如飛往東京卻住在大阪），則極大機率是預訂錯誤或跨區行程，需提醒使用者。
 */
export function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    if (lat1 == null || lat1 === '' || lon1 == null || lon1 === '' || lat2 == null || lat2 === '' || lon2 == null || lon2 === '') return null;
    const R = MAP.EARTH_RADIUS_KM;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Global state for Google Maps API loading
let googleMapsApiLoaded = false;
let googleMapsApiLoadPromise = null;

/**
 * Dynamically loads the Google Maps JavaScript API.
 * Ensures the API is loaded only once and handles multiple concurrent requests.
 * @param {string} apiKey Your Google Maps API Key.
 * @returns {Promise<void>} A promise that resolves when the API is loaded.
 */
export function loadGoogleMapsApi(apiKey) {
    if (googleMapsApiLoaded) {
        return Promise.resolve();
    }

    if (googleMapsApiLoadPromise) {
        return googleMapsApiLoadPromise; // Return existing promise if already loading
    }

    googleMapsApiLoadPromise = new Promise((resolve, reject) => {
        // Check if the script tag already exists to prevent duplicates
        const existingScript = document.querySelector(`script[src*="maps.googleapis.com/maps/api/js"]`);
        if (existingScript) {
            // script 已存在，poll 等待 window.google.maps 可用
            // 加 timeout guard 防止無限等待
            const pollStart = Date.now();
            const checkGoogleMapsInterval = setInterval(() => {
                if (window.google && window.google.maps) {
                    clearInterval(checkGoogleMapsInterval);
                    googleMapsApiLoaded = true;
                    resolve();
                } else if (Date.now() - pollStart > MAP.GEOCODE_POLL_TIMEOUT_MS) {
                    clearInterval(checkGoogleMapsInterval);
                    googleMapsApiLoadPromise = null;
                    reject(new Error('Google Maps API poll timeout: window.google.maps unavailable after 10s'));
                }
            }, MAP.GEOCODE_POLL_INTERVAL_MS);
            return;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMapsApi`;
        script.async = true;
        script.defer = true;
        script.setAttribute('loading', 'async');
        
        // Define a global callback function that Google Maps API will call
        window.initGoogleMapsApi = () => {
            googleMapsApiLoaded = true;
            resolve();
            delete window.initGoogleMapsApi; // Clean up global callback
        };

        script.onerror = (e) => {
            logger.error('Google Maps API script failed to load:', e);
            googleMapsApiLoaded = false;
            googleMapsApiLoadPromise = null;
            reject(e);
        };
        document.head.appendChild(script);
    });

    return googleMapsApiLoadPromise;
}

export async function geocodeAddress(address) {
    if (!address) return null;
    const mapboxKey = import.meta.env.VITE_MAPBOX_API_KEY;
    const googleKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    // 1. 優先使用 Google Maps JavaScript API 的 Geocoder 服務
    if (googleKey) {
        try {
            // 確保 Google Maps API 已經載入
            await loadGoogleMapsApi(googleKey);

            // 檢查 window.google.maps 是否存在
            if (!window.google || !window.google.maps || !window.google.maps.Geocoder) {
                throw new Error("Google Maps Geocoder not available after loading API.");
            }

            const geocoder = new window.google.maps.Geocoder();
            const response = await new Promise((resolve, reject) => {
                geocoder.geocode({ address: address }, (results, status) => {
                    if (status === window.google.maps.GeocoderStatus.OK && results && results.length > 0) {
                        resolve(results[0]);
                    } else if (status === window.google.maps.GeocoderStatus.ZERO_RESULTS) {
                        resolve(null); // 沒有找到結果
                    } else {
                        // Reject with the status for better error handling
                        reject(new Error(`Google Geocoding failed with status: ${status}`));
                    }
                });
            });

            if (response) {
                const lat = response.geometry.location.lat();
                const lng = response.geometry.location.lng();
                return { lat, lng, source: 'google' };
            }
        } catch (e) {
            logger.warn('Google Maps Geocoding (JavaScript API) failed:', e);
        }
    }

    // 2. Google Maps 失敗或無結果時，退回使用 Mapbox
    // 由於您目前沒有 Mapbox Key，這段會被跳過
    if (mapboxKey) {
        try {
            const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxKey}&limit=1`;
            const res = await fetch(mapboxUrl);
            const data = await res.json();
            if (data.features && data.features.length > 0) {
                const [lng, lat] = data.features[0].center; // Mapbox 回傳格式為 [lng, lat]
                return { lat, lng, source: 'mapbox' };
            }
        } catch (e) {
            logger.warn('Mapbox geocoding failed:', e);
        }
    }
    
    return null;
}

/**
 * 取得機場座標。優先從硬編碼列表讀取，其次從 localStorage 快取讀取，若無則透過 geocodeAddress 查詢並寫入快取。
 * @param {string} code - 例如 "NRT" 或 "KUL"
 * @param {string} apiKey - Google Maps API Key
 * @returns {Promise<{lat: number, lng: number}|null>}
 */
export async function getAirportCoordinates(code, apiKey) {
    if (!code) return null;
    const cleanCode = code.trim().toUpperCase();
    if (AIRPORT_COORDINATES[cleanCode]) {
        return AIRPORT_COORDINATES[cleanCode];
    }

    const cacheKey = `ap_coords_${cleanCode}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        try {
            return JSON.parse(cached);
        } catch (e) {
            localStorage.removeItem(cacheKey);
        }
    }

    if (apiKey) {
        try {
            const geo = await geocodeAddress(`${cleanCode} Airport`);
            if (geo) {
                const coords = { lat: geo.lat, lng: geo.lng };
                localStorage.setItem(cacheKey, JSON.stringify(coords));
                return coords;
            }
        } catch (e) {
            logger.error(`[geoUtils] Failed to dynamically geocode airport ${cleanCode}:`, e);
        }
    }
    return null;
}

/**
 * 全球主流旅遊城市預設中心坐標 (供未加入景點時的備援氣象與地圖定位)
 */
export const DEFAULT_CITY_COORDINATES = {
    // 台灣
    '台北': { lat: 25.0330, lng: 121.5654 },
    '臺北': { lat: 25.0330, lng: 121.5654 },
    'TAIPEI': { lat: 25.0330, lng: 121.5654 },
    '高雄': { lat: 22.6273, lng: 120.3014 },
    // 日本
    '東京': { lat: 35.6812, lng: 139.7671 },
    'TOKYO': { lat: 35.6812, lng: 139.7671 },
    '大阪': { lat: 34.6937, lng: 135.5023 },
    'OSAKA': { lat: 34.6937, lng: 135.5023 },
    '京都': { lat: 35.0116, lng: 135.7681 },
    'KYOTO': { lat: 35.0116, lng: 135.7681 },
    '沖繩': { lat: 26.2124, lng: 127.6809 },
    '福岡': { lat: 33.5904, lng: 130.4017 },
    '北海道': { lat: 43.0642, lng: 141.3469 },
    '札幌': { lat: 43.0642, lng: 141.3469 },
    // 韓國
    '首爾': { lat: 37.5665, lng: 126.9780 },
    '首尔': { lat: 37.5665, lng: 126.9780 },
    'SEOUL': { lat: 37.5665, lng: 126.9780 },
    '釜山': { lat: 35.1796, lng: 129.0756 },
    'BUSAN': { lat: 35.1796, lng: 129.0756 },
    '濟州': { lat: 33.4996, lng: 126.5312 },
    // 泰國
    '曼谷': { lat: 13.7563, lng: 100.5018 },
    'BANGKOK': { lat: 13.7563, lng: 100.5018 },
    '清邁': { lat: 18.7883, lng: 98.9853 },
    'CHIANG MAI': { lat: 18.7883, lng: 98.9853 },
    '普吉島': { lat: 7.8804, lng: 98.3923 },
    'PHUKET': { lat: 7.8804, lng: 98.3923 },
    // 英國
    '倫敦': { lat: 51.5074, lng: -0.1278 },
    'LONDON': { lat: 51.5074, lng: -0.1278 },
    '愛丁堡': { lat: 55.9533, lng: -3.1883 },
    // 法國與歐洲
    '巴黎': { lat: 48.8566, lng: 2.3522 },
    'PARIS': { lat: 48.8566, lng: 2.3522 },
    '羅馬': { lat: 41.9028, lng: 12.4964 },
    'ROME': { lat: 41.9028, lng: 12.4964 },
    '米蘭': { lat: 45.4642, lng: 9.1900 },
    '巴塞隆納': { lat: 41.3879, lng: 2.1699 },
    '阿姆斯特丹': { lat: 52.3676, lng: 4.9041 },
    '柏林': { lat: 52.5200, lng: 13.4050 },
    '維也納': { lat: 48.2082, lng: 16.3738 },
    // 美國
    '紐約': { lat: 40.7128, lng: -74.0060 },
    'NEW YORK': { lat: 40.7128, lng: -74.0060 },
    '洛杉磯': { lat: 34.0522, lng: -118.2437 },
    'LOS ANGELES': { lat: 34.0522, lng: -118.2437 },
    '舊金山': { lat: 37.7749, lng: -122.4194 },
    'SAN FRANCISCO': { lat: 37.7749, lng: -122.4194 },
    '西雅圖': { lat: 47.6062, lng: -122.3321 },
    'SEATTLE': { lat: 47.6062, lng: -122.3321 },
    // 新加坡 / 澳洲
    '新加坡': { lat: 1.3521, lng: 103.8198 },
    'SINGAPORE': { lat: 1.3521, lng: 103.8198 },
    '雪梨': { lat: -33.8688, lng: 151.2093 },
    'SYDNEY': { lat: -33.8688, lng: 151.2093 }
};

/**
 * 依城市或國家名稱比對預設經緯度
 * @param {string} destinationName 
 * @returns {{lat: number, lng: number}|null}
 */
export function getCityDefaultCoordinates(destinationName) {
    if (!destinationName || typeof destinationName !== 'string') return null;
    const clean = destinationName.trim().toUpperCase();
    for (const [key, coords] of Object.entries(DEFAULT_CITY_COORDINATES)) {
        if (clean.includes(key.toUpperCase())) return coords;
    }
    return null;
}

/**
 * 從地址字串中精準提煉行政「地區」（支援台日韓、東南亞、歐美英全球各國）
 * 專供天氣預報等宏觀標籤使用，避免重複顯示微觀景點或飯店名稱。
 * 
 * @param {string} address - Nominatim 結構化地址或地址字串
 * @param {string} [fallback=''] - 提取失敗時的回退預設值
 * @returns {string} 提取到的行政地區名稱
 */
export function extractRegionName(address, fallback = '') {
    if (!address || typeof address !== 'string') return fallback;

    // 0. 清洗 Nominatim 雙語分號 (如 "大倫敦;大伦敦" -> "大倫敦", "纽约;紐約" -> "紐約")
    const cleanAddress = address.replace(/;[\u4e00-\u9fa5a-zA-Z\s]+/g, '');

    // 1. 切分逗號段落
    const rawParts = cleanAddress.split(/[,，]/).map(s => s.trim()).filter(Boolean);

    // 優先 (1): 中文標準區級 (如：澀谷區、第七区、鍾路區、信義區)
    const chineseDistrict = rawParts.find(p => /^[\u4e00-\u9fa5]{1,5}[區区]$/.test(p));
    if (chineseDistrict) return chineseDistrict;

    // 優先 (2): 歐美英泰韓之行政區關鍵字 (Borough, Arrondissement, District, -gu, 구)
    const westernDistrict = rawParts.find(p => {
        if (/London Borough of\s+([A-Za-z\s]+)/i.test(p)) return true;
        if (/^(Manhattan|Brooklyn|Queens|Bronx|Staten Island)$/i.test(p)) return true;
        if (/Arrondissement/i.test(p)) return true;
        if (/(?<!Sub)District$/i.test(p) && !/Community/i.test(p)) return true;
        if (/^[A-Za-z]+-gu$/i.test(p)) return true;
        if (/^[가-힣]{1,4}구$/.test(p)) return true;
        return false;
    });
    if (westernDistrict) {
        const boroughMatch = westernDistrict.match(/London Borough of\s+([A-Za-z\s]+)/i);
        if (boroughMatch) return `${boroughMatch[1].trim()} 區`;
        return westernDistrict.replace(/\s+District$/i, ' 區');
    }

    // 優先 (3): 中文市/町/村級 (如：京都市、大阪市、輕井澤町、首爾特別市)
    const chineseCity = rawParts.find(p => /^[\u4e00-\u9fa5]{1,6}[市町村]$/.test(p));
    if (chineseCity) return chineseCity;

    // 優先 (4): 全球無「市」字之中文旅遊名城 (曼谷, 倫敦, 巴黎, 紐約, 首爾, 羅馬, 清邁, 普吉島等)
    const globalCityZh = rawParts.find(p => /^(曼谷|清邁|普吉島|首爾|首尔|倫敦|伦敦|巴黎|紐約|纽约|舊金山|旧金山|洛杉磯|洛杉矶|西雅圖|西雅图|芝加哥|羅馬|罗马|米蘭|米兰|威尼斯|佛羅倫斯|巴塞隆納|巴塞罗那|馬德里|马德里|阿姆斯特丹|柏林|維也納|维也纳|新加坡|雪梨|墨爾本|杜拜)$/i.test(p));
    if (globalCityZh) return globalCityZh;

    // 優先 (5): 歐美知名城市英文與當地拼寫 (London, Paris, Roma, Milano, etc.)
    const globalCityEn = rawParts.find(p => /^(London|Paris|New York|Bangkok|Seoul|Rome|Roma|Milan|Milano|Venice|Venezia|Florence|Firenze|Barcelona|Madrid|Amsterdam|Berlin|Munich|München|Vienna|Wien|Prague|Praha|Zurich|Zürich|Geneva|Genève|Singapore|Sydney|Melbourne|Dubai|Tokyo|Kyoto|Osaka)$/i.test(p));
    if (globalCityEn) return globalCityEn;

    // 優先 (6): 中文都/府/縣/道/州 (如：東京都、京都府、紐約州、加州、英格蘭)
    const chinesePref = rawParts.find(p => /^[\u4e00-\u9fa5]{1,5}[都府縣道州]$/.test(p));
    if (chinesePref) return chinesePref;

    // 優先 (7): 連續中文地址正則提取 (無逗號時)
    const inlineDistrict = cleanAddress.match(/(?:[都府縣道市])?([^\s,，都府縣道市]{1,4}[區区])/);
    if (inlineDistrict) return inlineDistrict[1];

    const inlineCity = cleanAddress.match(/(?:[都府縣道郡]+)?([^\s,，都府縣道郡]{1,4}[市町村])/);
    if (inlineCity) return inlineCity[1];

    const inlinePref = cleanAddress.match(/([^\s,，]{1,4}[都府縣道州])/);
    if (inlinePref) return inlinePref[1];

    return fallback;
}