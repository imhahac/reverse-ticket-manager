/**
 * useGoogleAuth.js ── Google OAuth 認證 Hook
 *
 * 封裝所有與 Google 登入/登出相關的邏輯：
 *   - login()：觸發 OAuth 彈窗
 *   - logout()：清除 token
 *   - trySilentRefresh()：嘗試靜默更新 token（Promise<boolean>）
 *   - 背景 interval：token 快過期時自動觸發 silentRefresh
 *
 * 向上 export：{ accessToken, accessTokenState, login, logout, trySilentRefresh }
 * isSyncing 由 useGoogleSync 自己管理，不在此 hook 中。
 */
import { useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useGoogleLogin, googleLogout } from '@react-oauth/google';
import { useLocalStorage } from './useLocalStorage';
import { logger } from '../utils/logger';
import { TIMING } from '../constants/timing';
import { ERRORS } from '../constants/errors';
import { STORAGE_KEYS } from '../constants/storageKeys';

const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/calendar.events';

export function useGoogleAuth() {
    // ── 持久化 token（向後相容舊版 string 格式）──────────────────────────────
    const [accessTokenState, setAccessTokenState] = useLocalStorage(STORAGE_KEYS.GOOGLE_ACCESS_TOKEN, null);
    // 舊版存純 string，新版存 { token, expiresAt }
    const accessToken = typeof accessTokenState === 'string'
        ? accessTokenState
        : accessTokenState?.token || null;
    const accessTokenExpiresAt = typeof accessTokenState === 'object'
        ? accessTokenState?.expiresAt || null
        : null;

    // 用 ref 儲存 silentRefresh 的 resolve callback，避免閉包問題
    const refreshResolverRef = useRef(null);

    const parseTokenResponse = (codeResponse) => {
        const expiresAt = Date.now() + Number(codeResponse.expires_in || TIMING.AUTH_DEFAULT_EXPIRES_IN_S) * 1000;
        setAccessTokenState({ token: codeResponse.access_token, expiresAt });
    };

    // ── silentLogin：瀏覽器背景靜默更新（不彈窗，best-effort）─────────────
    const silentLogin = useGoogleLogin({
        prompt: 'none',
        scope: GOOGLE_SCOPE,
        onSuccess: (codeResponse) => {
            parseTokenResponse(codeResponse);
            refreshResolverRef.current?.(true);
            refreshResolverRef.current = null;
        },
        onError: (error) => {
            logger.warn('Silent refresh failed:', error);
            refreshResolverRef.current?.(false);
            refreshResolverRef.current = null;
        },
    });

    // ── login：主動登入（彈窗）────────────────────────────────────────────
    const login = useGoogleLogin({
        scope: GOOGLE_SCOPE,
        onSuccess: (codeResponse) => {
            parseTokenResponse(codeResponse);
            toast.success('Google 登入成功！');
        },
        onError: (error) => {
            logger.error('Login Failed:', error);
            if (error?.error === 'popup_closed_by_user') {
                toast.error('您已取消 Google 登入', { duration: 4000 });
            } else {
                toast.error('Google 登入失敗', {
                    description: `錯誤訊息: ${error?.error_description || error?.error || '未知錯誤'}。請確認 Client ID 與已授權的 JavaScript 來源。`,
                    duration: 8000,
                });
            }
        },
    });

    // ── logout ────────────────────────────────────────────────────────────
    const logout = () => {
        googleLogout();
        setAccessTokenState(null);
    };

    /**
     * isTokenExpired：檢查目前 token 是否已過期或缺少 expiresAt。
     * 回傳 true 表示 token 不可用，應先 refresh 再操作。
     */
    const isTokenExpired = () => {
        if (!accessToken) return true;
        if (!accessTokenExpiresAt || isNaN(accessTokenExpiresAt)) return false; // 舊格式 token，不強制判斷
        return Date.now() >= accessTokenExpiresAt;
    };

    /**
     * trySilentRefresh：嘗試靜默更新，回傳 Promise<boolean>。
     * 超過 8 秒視為失敗，避免永久 hang。
     */
    const trySilentRefresh = () => {
        // 競態 guard：若已有進行中的 refresh，直接回傳 false，
        // 避免覆蓋舊 resolver 導致舊 Promise 永遠 hang 到 8 秒 timeout。
        if (refreshResolverRef.current) {
            return Promise.resolve(false);
        }
        return new Promise((resolve) => {
            refreshResolverRef.current = resolve;
            
            try {
                silentLogin();
            } catch (e) {
                logger.error('Silent login trigger failed:', e);
                refreshResolverRef.current(false);
                refreshResolverRef.current = null;
                return;
            }

            setTimeout(() => {
                if (refreshResolverRef.current) {
                    refreshResolverRef.current(false);
                    refreshResolverRef.current = null;
                    toast.error('Google Token 更新超時', { description: '若持續出現異常，請手動重新登入。' });
                }
            }, TIMING.SILENT_REFRESH_TIMEOUT_MS);
        });
    };

    // ── 背景 interval：token 剩阈值時自動嘗試更新 ─────────────────────
    useEffect(() => {
        if (!accessToken) return;

        const checkExpiration = () => {
            if (!accessTokenState || !accessTokenState.expiresAt) return;

            const now = Date.now();
            const timeRemaining = accessTokenState.expiresAt - now;

            // 情況 1：token 已徹底過期（超過 1 分鐘緩衝）-> 直接登出，不嘗試背景刷新
            if (timeRemaining < -60000) {
                logger.warn('Token severely expired, clearing state.');
                logout();
                toast.error(ERRORS.AUTH_EXPIRED);
                return;
            }

            // 情況 2：token 快到期了 -> 嘗試靜默更新
            if (timeRemaining < TIMING.TOKEN_EXPIRY_THRESHOLD) {
                logger.info('Token near expiry, attempting silent refresh...');
                trySilentRefresh();
            }
        };

        // 首次掛載時立即檢查一次
        checkExpiration();

        const interval = setInterval(checkExpiration, TIMING.AUTH_CHECK_INTERVAL);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accessToken, accessTokenState]);

    return { accessToken, accessTokenState, login, logout, isTokenExpired, trySilentRefresh };
}
