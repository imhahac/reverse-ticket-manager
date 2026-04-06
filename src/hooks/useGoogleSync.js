/**
 * useGoogleSync.js ── Google Drive & Calendar 同步 Hook
 *
 * 封裝所有雲端同步操作，依賴外部傳入的認證資訊。
 *
 * @param {Object} params
 * @param {string|null} params.accessToken        - 目前的 Google access token
 * @param {any}         params.accessTokenState   - 原始 token state（含 expiresAt）
 * @param {Function}    params.trySilentRefresh   - 嘗試靜默更新 token，回傳 Promise<boolean>
 * @param {Function}    params.logout             - 登出函式
 * @param {Array}       params.tickets            - 機票資料陣列
 * @param {Object}      params.tripLabels         - 行程標籤 map
 * @param {Function}    params.setTickets         - 更新 tickets 的 setter
 * @param {Function}    params.setTripLabels      - 更新 tripLabels 的 setter
 * @param {Array}       params.hotels             - 食店住宿資料（已裝飾）
 * @param {Array}       params.rawHotels          - 食店住宿原始資料（不含衍生欄位）
 * @param {Function}    params.setHotels          - 更新 hotels 的 setter
 * @param {Function}    params.updateHotelCalendarIds - 回寫日曆事件 ID
 *
 * export：{ isSyncing, handleSyncToDrive, handleLoadFromDrive, handleSyncToCalendar }
 */
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { syncToDrive, loadFromDrive, syncToCalendar } from '../utils/googleSync';
import { createRefreshTokenManager, runSyncActionSafely } from '../utils/googleSync/guard';

export function useGoogleSync({
    accessToken,
    accessTokenState,
    trySilentRefresh,
    isTokenExpired,
    logout,
    tickets,
    tripLabels,
    setTickets,
    setTripLabels,
    hotels = [],
    rawHotels = [],
    activities = [],
    segments = [],
    setHotels,
    setActivities,
    updateHotelCalendarIds,
    updateActivityCalendarId,
}) {
    const [isSyncing, setIsSyncing] = useState(false);
    const refreshTokenOnce = useMemo(
        () => createRefreshTokenManager(async () => trySilentRefresh()),
        [trySilentRefresh]
    );

    // 取得當前最新 token（相容舊版 string 格式）
    const getCurrentToken = () =>
        typeof accessTokenState === 'string'
            ? accessTokenState
            : accessTokenState?.token || accessToken;

    // ── 高階函式：封裝 Token 檢查與 Refresh 重試邏輯 ───────────────────
    const withAuthGuard = async (actionFn, loadMsg) => {
        if (!accessToken) {
            toast.error('請先登入 Google');
            return null;
        }

        if (isTokenExpired?.()) {
            const ok = await refreshTokenOnce();
            if (!ok) {
                toast.error('登入已過期，請重新登入 Google');
                logout();
                return null;
            }
        }

        setIsSyncing(true);
        const toastId = toast.loading(loadMsg);
        let res = await runSyncActionSafely(actionFn, getCurrentToken());
        setIsSyncing(false);

        if (!res.success && res.expired) {
            const ok = await refreshTokenOnce();
            if (ok) {
                setIsSyncing(true);
                res = await runSyncActionSafely(actionFn, getCurrentToken());
                setIsSyncing(false);
            } else {
                toast.error('登入已過期，請重新登入 Google', { id: toastId });
                logout();
                return null;
            }
        }

        return { res, toastId };
    };

    // ── 備份到 Drive ──────────────────────────────────────────────────────
    const handleSyncToDrive = async () => {
        const guard = await withAuthGuard(
            (token) => syncToDrive(tickets, tripLabels, rawHotels, token, activities),
            '正在備份至 Google Drive…'
        );
        if (!guard) return;
        const { res, toastId } = guard;

        if (res.success) {
            toast.success('雲端備份成功！', {
                id: toastId,
                description: `資料已備份至 Google Drive。(檔案 ID: ${res.fileId})`,
            });
        } else {
            toast.error('雲端備份失敗', { id: toastId, description: res.error });
        }
    };

    // ── 從 Drive 載入 ─────────────────────────────────────────────────────
    const handleLoadFromDrive = async () => {
        const guard = await withAuthGuard(
            (token) => loadFromDrive(token),
            '正在從 Google Drive 載入…'
        );
        if (!guard) return;
        const { res, toastId } = guard;

        const confirmImport = (result) => {
            toast.dismiss(toastId);
            toast(`雲端讀取成功，共 ${result.tickets.length} 筆趟次`, {
                description: `找到的檔案：${result.foundFilesLog}`,
                action: {
                    label: '確認覆寫',
                    onClick: () => {
                        setTickets(result.tickets);
                        setTripLabels(result.tripLabels || {});
                        if (result.hotels?.length > 0 && setHotels) setHotels(result.hotels);
                        if (result.activities?.length > 0 && setActivities) setActivities(result.activities);
                        toast.success('雲端資料載入成功！');
                    },
                },
                cancel: { label: '取消', onClick: () => {} },
                duration: 12000,
            });
        };

        if (res.success) {
            confirmImport(res);
        } else {
            toast.error('雲端載入失敗', { id: toastId, description: res.error });
        }
    };

    // ── 同步到 Google Calendar ────────────────────────────────────────────
    const handleSyncToCalendar = async () => {
        const guard = await withAuthGuard(
            (token) => syncToCalendar(segments, hotels, activities, token),
            '正在同步至 Google Calendar…'
        );
        if (!guard) return;
        const { res, toastId } = guard;

        if (res.success) {
            // 將新的 calendarIds 回寫到 tickets
            if (res.updatedCalendarIds && Object.keys(res.updatedCalendarIds).length > 0) {
                setTickets(prev => prev.map(t =>
                    res.updatedCalendarIds[t.id]
                        ? { ...t, calendarIds: { ...(t.calendarIds || {}), ...res.updatedCalendarIds[t.id] } }
                        : t
                ));
            }
            // 將飯店日曆 ID 回寫
            if (res.updatedHotelCalendarIds && updateHotelCalendarIds) {
                Object.entries(res.updatedHotelCalendarIds).forEach(([hotelId, ids]) => {
                    updateHotelCalendarIds(hotelId, ids.checkInId, ids.checkOutId);
                });
            }
            // 將活動日曆 ID 回寫
            if (res.updatedActivityCalendarIds && updateActivityCalendarId) {
                Object.entries(res.updatedActivityCalendarIds).forEach(([activityId, calendarId]) => {
                    updateActivityCalendarId(activityId, calendarId);
                });
            }
            
            const deletedNote = res.deletedCount > 0
                ? `，已自動清除 ${res.deletedCount} 個廢棄事件`
                : '';
            toast.success('日曆同步成功！', {
                id: toastId,
                description: `共同步 ${res.count} 個航班事件${deletedNote}。${res.error ? `\n⚠️ 部分警告：${res.error}` : ''}`,
                duration: 6000,
            });
        } else {
            toast.error('日曆同步失敗', {
                id: toastId,
                description: res.error || '同步過程中發生錯誤，請稍後再試。',
            });
        }
    };

    return { isSyncing, handleSyncToDrive, handleLoadFromDrive, handleSyncToCalendar };
}
