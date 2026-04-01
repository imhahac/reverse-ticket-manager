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
    const errors = [];
    
    const required = [
        { key: 'VITE_GOOGLE_CLIENT_ID', error: ERRORS.MISSING_CLIENT_ID },
        { key: 'VITE_GOOGLE_MAPS_API_KEY', error: '遺失 VITE_GOOGLE_MAPS_API_KEY：此為渲染地圖與地址定位所需的必備金鑰。' },
    ];

    required.forEach(item => {
        const value = import.meta.env[item.key];
        if (!value || isPlaceholder(value)) {
            errors.push(item.error);
        }
    });

    if (errors.length > 0) {
        logger.error('Environment Validation Failed:', errors.join('\n'));
        return { valid: false, errors };
    }

    // 次要變數警告 (不阻斷)
    if (!import.meta.env.VITE_FLIGHT_PROXY_URL) {
        logger.warn('建議設定 VITE_FLIGHT_PROXY_URL 以隱藏航班 API 金鑰。');
    }
    
    if (!import.meta.env.VITE_MAPBOX_API_KEY) {
        logger.warn('Mapbox 金鑰未設定，系統將僅使用 Google Maps。');
    }

    return { valid: true, errors: [] };
};
