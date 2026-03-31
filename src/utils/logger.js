/**
 * logger.js — 統一日誌策略
 *
 * - debug / info：只在 development 輸出，production 靜默
 * - warn / error：兩個環境都保留（方便 Sentry 等工具捕捉）
 *
 * 使用方式：
 *   import { logger } from '../utils/logger';
 *   logger.debug('載入完成', data);
 *   logger.error('同步失敗', err);
 */

const isDev = import.meta.env.DEV;

export const logger = {
    debug: (...args) => { if (isDev) console.debug('[DEBUG]', ...args); },
    info:  (...args) => { if (isDev) console.info('[INFO]', ...args); },
    warn:  (...args) => console.warn('[WARN]', ...args),
    error: (...args) => console.error('[ERROR]', ...args),
};
