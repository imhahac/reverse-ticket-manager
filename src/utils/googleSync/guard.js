/**
 * googleSync/guard.js
 * 同步流程共用守門工具：refresh 單飛 + action 安全執行。
 */

/**
 * 建立單飛 refresh 管理器。
 * 同時間多次呼叫只會共用同一個 in-flight Promise。
 */
export const createRefreshTokenManager = (refreshFn) => {
    let inFlightPromise = null;

    return async () => {
        if (inFlightPromise) return inFlightPromise;

        inFlightPromise = Promise.resolve()
            .then(() => refreshFn())
            .then(Boolean)
            .catch(() => false)
            .finally(() => {
                inFlightPromise = null;
            });

        return inFlightPromise;
    };
};

/**
 * 安全執行同步 action，確保回傳固定格式。
 */
export const runSyncActionSafely = async (actionFn, token) => {
    try {
        const res = await actionFn(token);
        if (res && typeof res === 'object' && typeof res.success === 'boolean') {
            return res;
        }
        return {
            success: false,
            expired: false,
            error: '同步回傳格式不正確，請稍後再試。',
        };
    } catch (error) {
        return {
            success: false,
            expired: false,
            error: error?.message || '同步過程中發生錯誤，請稍後再試。',
        };
    }
};
