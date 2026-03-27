/**
 * config.js
 * 集中管理環境變數與靜態配置，提供統一的驗證機制
 */

export const CONFIG = {
    googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
    aviationStackKey: import.meta.env.VITE_AVIATIONSTACK_API_KEY || '',
    airLabsKey: import.meta.env.VITE_AIRLABS_API_KEY || '',
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
    if (!CONFIG.aviationStackKey && !CONFIG.airLabsKey) warnings.push('遺失航班 API Keys (AviationStack/AirLabs)：航班自動填寫功能將無法使用。');
    
    if (warnings.length > 0) {
        console.warn('⚠️ [系統配置警告]\n' + warnings.join('\n'));
    }
    return warnings;
};
