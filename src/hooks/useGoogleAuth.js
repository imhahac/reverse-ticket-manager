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

const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/calendar.events';

export function useGoogleAuth() {
    // ── 持久化 token（向後相容舊版 string 格式）──────────────────────────────
    const [accessTokenState, setAccessTokenState] = useLocalStorage('google-access-token', null);
    // 舊版存純 string，新版存 { token, expiresAt }
    const accessToken = typeof accessTokenState === 'string'
        ? accessTokenState
        : accessTokenState?.token || null;
    const accessTokenExpiresAt = typeof accessTokenState === 'object'
        ? accessTokenState?.expiresAt || null
        : null;

    // 用 ref 儲存 silentRefresh 的 resolve callback，避免閉包問題
    const refreshResolverRef = useRef(null);

    // ── silentLogin：瀏覽器背景靜默更新（不彈窗，best-effort）─────────────
    const silentLogin = useGoogleLogin({
        prompt: 'none',
        scope: GOOGLE_SCOPE,
        onSuccess: (codeResponse) => {
            const expiresAt = Date.now() + Number(codeResponse.expires_in || 3600) * 1000;
            setAccessTokenState({ token: codeResponse.access_token, expiresAt });
            refreshResolverRef.current?.(true);
            refreshResolverRef.current = null;
        },
        onError: (error) => {
            console.warn('Silent refresh failed:', error);
            refreshResolverRef.current?.(false);
            refreshResolverRef.current = null;
        },
    });

    // ── login：主動登入（彈窗）────────────────────────────────────────────
    const login = useGoogleLogin({
        scope: GOOGLE_SCOPE,
        onSuccess: (codeResponse) => {
            const expiresAt = Date.now() + Number(codeResponse.expires_in || 3600) * 1000;
            setAccessTokenState({ token: codeResponse.access_token, expiresAt });
            toast.success('Google 登入成功！');
        },
        onError: (error) => {
            console.error('Login Failed:', error);
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
                console.error("Silent login trigger failed:", e);
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
            }, 8000);
        });
    };

    // ── 背景 interval：token 剩 10 分鐘時自動嘗試更新 ─────────────────────
    useEffect(() => {
        if (!accessToken || !accessTokenExpiresAt) return;
        const interval = setInterval(() => {
            if (accessTokenExpiresAt - Date.now() < 10 * 60 * 1000) {
                trySilentRefresh();
            }
        }, 5 * 60 * 1000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accessToken, accessTokenExpiresAt]);

    return { accessToken, accessTokenState, login, logout, trySilentRefresh };
}
