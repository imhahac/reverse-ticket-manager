/**
 * env.js
 * 嚴格驗證環境變數。若缺少關鍵變數則拋出例外，阻斷應用程式啟動。
 */
import { ERRORS } from '../constants/errors';
import { logger } from '../utils/logger';

export const validateEnv = () => {
    const required = [
        { key: 'VITE_GOOGLE_CLIENT_ID', error: ERRORS.MISSING_CLIENT_ID },
    ];

    const missing = required.filter(item => !import.meta.env[item.key]);

    if (missing.length > 0) {
        const errorMsg = missing.map(m => m.error).join('\n');
        logger.error('Environment Validation Failed:', errorMsg);
        
        // 在生產環境或嚴格模式下拋出錯誤以阻斷啟動
        throw new Error(errorMsg);
    }

    // 次要變數：僅警告不阻斷
    if (!import.meta.env.VITE_FLIGHT_PROXY_URL) {
        logger.warn('建議設定 VITE_FLIGHT_PROXY_URL 以隱藏航班 API 金鑰。');
    }
    
    if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
        logger.warn('缺少 VITE_GOOGLE_MAPS_API_KEY，地圖功能將無法正常運作。');
    }
};
