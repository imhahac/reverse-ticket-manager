/**
 * config.js
 * 集中管理環境變數與靜態配置，提供統一的驗證機制
 */

export const CONFIG = {
    googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    flightProxyUrl: import.meta.env.VITE_FLIGHT_PROXY_URL,
    aviationStackKey: import.meta.env.VITE_AVIATIONSTACK_API_KEY,
    airLabsKey: import.meta.env.VITE_AIRLABS_API_KEY,
    exchangeRates: {
        'TWD': 1,
        'JPY': 0.21,
        'USD': 32.0,
        'KRW': 0.024,
        'EUR': 34.0,
        'GBP': 40.0,
        'THB': 0.9,
        'CNY': 4.4,
        'HKD': 4.1
    }
};


/** Google Maps 地圖相關常數 */
export const MAP = {
    /** 預設地圖中心（台灣） */
    DEFAULT_CENTER: { lat: 23.6978, lng: 120.9605 },
    /** 預設縮放層級 */
    DEFAULT_ZOOM: 6,
    /** 聚焦飯店時的縮放層級 */
    HOTEL_FOCUS_ZOOM: 14,
    /** 單一點位時的最大允許縮放層級（避免放太大） */
    MAX_SINGLE_POINT_ZOOM: 10,
    /** checkGoogleMapsInterval 的 poll 間隔（ms） */
    GEOCODE_POLL_INTERVAL_MS: 100,
    /** checkGoogleMapsInterval 的最長等待時間（ms），超時 reject */
    GEOCODE_POLL_TIMEOUT_MS: 10000,
    /** 地球半徑（km），用於 Haversine 公式 */
    EARTH_RADIUS_KM: 6371,
    /** 飯店距機場超過此距離（km）視為警告 */
    HOTEL_DISTANCE_WARNING_KM: 200,
};

export const validateConfig = () => {
    const warnings = [];
    if (!CONFIG.googleClientId) warnings.push('遺失 VITE_GOOGLE_CLIENT_ID：Google 登入與日曆同步將無法使用。');
    if (!CONFIG.flightProxyUrl && !CONFIG.aviationStackKey && !CONFIG.airLabsKey) {
        warnings.push('遺失航班 API 配置：請設定 VITE_FLIGHT_PROXY_URL (推薦) 或直接填入 API Keys。');
    } else if (!CONFIG.flightProxyUrl) {
        // 如果有 Key 但沒 Proxy，給個建議但不算嚴重警告
        console.info('Tip: 設定 VITE_FLIGHT_PROXY_URL 可以更安全地隱藏您的 API 金鑰。');
    }
    
    return warnings;
};
