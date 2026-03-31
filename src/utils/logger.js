/**
 * logger.js
 * 簡單的日誌封裝，支援等級過濾。
 */

const IS_DEV = import.meta.env.DEV;

export const logger = {
    info: (...args) => {
        if (IS_DEV) console.log('🟢 [INFO]', ...args);
    },
    warn: (...args) => {
        console.warn('🟡 [WARN]', ...args);
    },
    error: (...args) => {
        console.error('🔴 [ERROR]', ...args);
    },
    debug: (...args) => {
        if (IS_DEV) console.debug('🔵 [DEBUG]', ...args);
    }
};
