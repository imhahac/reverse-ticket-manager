/**
 * config.js
 * 集中管理環境變數與靜態配置，提供統一的驗證機制
 */

export const CONFIG = {
    googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
    flightProxyUrl: import.meta.env.VITE_FLIGHT_PROXY_URL || '',
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

export const validateConfig = () => {
    const warnings = [];
    if (!CONFIG.googleClientId) warnings.push('遺失 VITE_GOOGLE_CLIENT_ID：Google 登入與日曆同步將無法使用。');
    if (!CONFIG.flightProxyUrl) warnings.push('遺失 VITE_FLIGHT_PROXY_URL：請架設 Cloudflare Worker 以啟用航班自動帶入防護。');
    
    return warnings;
};
