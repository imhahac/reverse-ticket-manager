/**
 * env.js
 * 嚴格驗證環境變數。若缺少關鍵變數或含有佔位符清單，則返回錯誤清單供進入渲染攔截。
 */
import { ERRORS } from '../constants/errors';
import { logger } from '../utils/logger';

const DUMMY_STRINGS = [
    'YOUR_GOOGLE_CLIENT_ID',
    'YOUR_MAPBOX_API_KEY',
    'YOUR_GOOGLE_MAPS_API_KEY',
    'REPLACE_ME',
    'DUMMY_KEY',
    'INSERT_HERE',
];

const isPlaceholder = (value) => {
    if (!value) return true;
    const upperValue = value.toUpperCase();
    return DUMMY_STRINGS.some(dummy => upperValue.includes(dummy));
};

export const validateEnv = () => {
    const warnings = [];
    const errors = [];
    
    // 檢查 Google Client ID (僅影響 Google 雲端同步)
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!googleClientId || isPlaceholder(googleClientId)) {
        warnings.push('未設定 VITE_GOOGLE_CLIENT_ID：Google 雲端備份與日曆同步將處於離線訪客模式。');
    }

    // 檢查 Google Maps Key (已升級為免 Token 向量地圖 MapLibre，Google Maps 僅作可選備份)
    const googleMapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!googleMapsKey || isPlaceholder(googleMapsKey)) {
        warnings.push('未設定 VITE_GOOGLE_MAPS_API_KEY：系統將優先使用免 Token 的高效能向量地圖。');
    }

    // 嚴格生產模式檢查 (選填)
    if (import.meta.env.VITE_STRICT_ENV === 'true') {
        if (!googleClientId || isPlaceholder(googleClientId)) errors.push(ERRORS.MISSING_CLIENT_ID);
        if (!googleMapsKey || isPlaceholder(googleMapsKey)) errors.push('遺失 VITE_GOOGLE_MAPS_API_KEY。');
    }

    if (errors.length > 0) {
        logger.error('Environment Validation Failed (Strict Mode):', errors.join('\n'));
        return { valid: false, errors };
    }

    if (warnings.length > 0) {
        logger.warn('環境變數提示 (離線模式啟動):', warnings.join('\n'));
    }

    return { valid: true, errors: [], warnings };
};
