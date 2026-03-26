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
import { useState } from 'react';
import { toast } from 'sonner';
import { syncToDrive, loadFromDrive, syncToCalendar } from '../utils/googleSync';

export function useGoogleSync({
    accessToken,
    accessTokenState,
    trySilentRefresh,
    logout,
    tickets,
    tripLabels,
    setTickets,
    setTripLabels,
    hotels = [],
    rawHotels = [],
    activities = [],
    setHotels,
    setActivities,
    updateHotelCalendarIds,
}) {
    const [isSyncing, setIsSyncing] = useState(false);

    // 取得當前最新 token（相容舊版 string 格式）
    const getCurrentToken = () =>
        typeof accessTokenState === 'string'
            ? accessTokenState
            : accessTokenState?.token || accessToken;

    // ── 備份到 Drive ──────────────────────────────────────────────────────
    const handleSyncToDrive = async () => {
        if (!accessToken) return toast.error('請先登入 Google');
        setIsSyncing(true);
        const toastId = toast.loading('正在備份至 Google Drive…');
        let res = await syncToDrive(tickets, tripLabels, rawHotels, accessToken, activities);
        setIsSyncing(false);

        if (res.success) {
            toast.success('雲端備份成功！', {
                id: toastId,
                description: `資料已備份至 Google Drive。(檔案 ID: ${res.fileId})`,
            });
        } else {
            if (res.expired) {
                const ok = await trySilentRefresh();
                if (ok) {
                    setIsSyncing(true);
                    res = await syncToDrive(tickets, tripLabels, rawHotels, getCurrentToken(), activities);
                    setIsSyncing(false);
                    if (res.success) {
                        return toast.success('雲端備份成功！', { id: toastId, description: `資料已備份至 Google Drive。(檔案 ID: ${res.fileId})` });
                    }
                }
                toast.error('登入已過期，請重新登入 Google', { id: toastId });
                return logout();
            }
            toast.error('雲端備份失敗', { id: toastId, description: res.error });
        }
    };

    // ── 從 Drive 載入 ─────────────────────────────────────────────────────
    const handleLoadFromDrive = async () => {
        if (!accessToken) return toast.error('請先登入 Google');
        setIsSyncing(true);
        const toastId = toast.loading('正在從 Google Drive 載入…');
        let res = await loadFromDrive(accessToken);
        setIsSyncing(false);

        const confirmImport = (result) => {
            toast.dismiss(toastId);
            toast(`雲端讀取成功，共 ${result.tickets.length} 筆趟次`, {
                description: `找到的檔案：${result.foundFilesLog}`,
                action: {
                    label: '確認覆寫',
                    onClick: () => {
                        setTickets(result.tickets);
                        setTripLabels(result.tripLabels || {});
                        if (result.hotels?.length > 0 && setHotels) {
                            setHotels(result.hotels);
                        }
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
            if (res.expired) {
                const ok = await trySilentRefresh();
                if (ok) {
                    setIsSyncing(true);
                    res = await loadFromDrive(getCurrentToken());
                    setIsSyncing(false);
                    if (res.success) return confirmImport(res);
                }
                toast.error('登入已過期，請重新登入 Google', { id: toastId });
                return logout();
            }
            toast.error('雲端載入失敗', { id: toastId, description: res.error });
        }
    };

    // ── 同步到 Google Calendar ────────────────────────────────────────────
    const handleSyncToCalendar = async () => {
        if (!accessToken) return toast.error('請先登入 Google');
        setIsSyncing(true);
        const toastId = toast.loading('正在同步至 Google Calendar…');
        let res = await syncToCalendar(tickets, hotels, accessToken);
        setIsSyncing(false);

        const showCalendarSuccess = (result) => {
            const deletedNote = result.deletedCount > 0
                ? `，已自動清除 ${result.deletedCount} 個廢棄事件`
                : '';
            toast.success('日曆同步成功！', {
                id: toastId,
                description: `共同步 ${result.count} 個航班事件${deletedNote}。${result.error ? `\n⚠️ 部分警告：${result.error}` : ''}`,
                duration: 6000,
            });
        };

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
            showCalendarSuccess(res);
        } else {
            if (res.expired) {
                const ok = await trySilentRefresh();
                if (ok) {
                    setIsSyncing(true);
                    res = await syncToCalendar(tickets, hotels, getCurrentToken());
                    setIsSyncing(false);
                    if (res.success) {
                        toast.dismiss(toastId);
                        return showCalendarSuccess(res);
                    }
                }
            }
            toast.error('日曆同步失敗', {
                id: toastId,
                description: res.error || 'Access Token 可能已過期，請重新登入。',
            });
            logout();
        }
    };

    return { isSyncing, handleSyncToDrive, handleLoadFromDrive, handleSyncToCalendar };
}
