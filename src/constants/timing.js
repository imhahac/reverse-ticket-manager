/**
 * timing.js
 * 統一管理系統內所有的延遲、超時與過期時間。
 * 單位皆為毫秒 (ms)。
 */

export const TIMING = {
    // UI
    DEBOUNCE_SEARCH: 300,
    TOAST_DURATION: 4000,
    TOAST_LONG_DURATION: 8000,
    
    // Auth & Token
    AUTH_CHECK_INTERVAL: 5 * 60 * 1000, // 每 5 分鐘檢查一次 token
    TOKEN_EXPIRY_THRESHOLD: 10 * 60 * 1000, // Token 剩 10 分鐘時即報為過期
    
    // Sync
    RETRY_SYNC_DELAY: 2000,
    
    // Data
    SHARE_EXPIRY_DAYS: 30, // 分享連結的有效期
    STALE_DATA_TTL: 24 * 60 * 60 * 1000, // 24 小時資料過期 (僅供快取參考)
};
