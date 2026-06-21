import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useExchangeRates } from '../hooks/useExchangeRates';
import { useTrips } from '../hooks/useTrips';
import { useTripOverrides } from '../hooks/useTripOverrides';
import { useHotels } from '../features/hotels/hooks/useHotels';
import { useActivities } from '../hooks/useActivities';
import { useEntityManager } from '../hooks/useEntityManager';
import { exportData, importData } from '../utils/importExportUtils';
import { toast } from 'sonner';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { createMagicSyncSnapshot, fetchMagicSyncSnapshot } from '../services/shareService';

export const DataContext = createContext();

export function DataProvider({ children }) {
    // ── 持久化資料 ───────────────────────────────────────────────────────────
    const [tickets, setTickets] = useLocalStorage(STORAGE_KEYS.TICKETS, []);
    const [tripLabels, setTripLabels] = useLocalStorage(STORAGE_KEYS.TRIP_LABELS, {});
    const [tripBudgets, setTripBudgets] = useLocalStorage(STORAGE_KEYS.TRIP_BUDGETS, {});

    // ── UI 狀態 (僅保留表單編輯狀態) ──────────────────────────────────────────
    const [editingTicket, setEditingTicket] = useState(null);

    // ── 原始資料 Hooks ──────────────────────────────────────────────────────
    const { exchangeRates } = useExchangeRates();
    const { segments = [], trips = [] } = useTrips(Array.isArray(tickets) ? tickets : []);
    const { overrides: tripOverrides, setOverrides, removeSegment, restoreSegment, moveSegmentToTrip, clearAllOverrides } = useTripOverrides();
    const { hotels = [], rawHotels = [], addHotel, updateHotel, deleteHotel, updateHotelCalendarIds, setHotels } = useHotels();
    const { activities = [], setActivities, addActivity, updateActivity, deleteActivity, updateActivityCalendarId } = useActivities();

    // ── 機票 CRUD ─────────────────────────────────────────────────────────────
    const handleSaveTicket = (ticket) => {
        setTickets(prev => editingTicket ? prev.map(t => t.id === ticket.id ? ticket : t) : [...prev, ticket]);
        setEditingTicket(null);
    };
    const handleEditTicket = (ticket) => { setEditingTicket(ticket); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    const handleCancelEdit = () => setEditingTicket(null);
    const handleDeleteTicket = (id) => {
        toast('確定要刪除這筆機票訂單嗎？', {
            description: '相關的趟次配對將會被移除。',
            action: { label: '確認刪除', onClick: () => setTickets(prev => prev.filter(t => t.id !== id)) },
            cancel: { label: '取消', onClick: () => {} },
            duration: 8000,
        });
    };

    // ── 飯店 CRUD ─────────────────────────────────────────────────────────────
    const { editingItem: editingHotel, handleSave: handleSaveHotel, handleEdit: handleEditHotel, handleCancelEdit: handleCancelEditHotel, handleDelete: handleDeleteHotel, isSaving: isSavingHotel } = useEntityManager({
        itemName: '飯店', titleField: 'name', locationField: 'address', addFn: addHotel, updateFn: updateHotel, deleteFn: deleteHotel
    });

    // ── 活動 CRUD ─────────────────────────────────────────────────────────────
    const { editingItem: editingActivity, handleSave: handleSaveActivity, handleEdit: handleEditActivity, handleCancelEdit: handleCancelEditActivity, handleDelete: handleDeleteActivity, isSaving: isSavingActivity } = useEntityManager({
        itemName: '活動/票卷', titleField: 'title', locationField: 'location', addFn: addActivity, updateFn: updateActivity, deleteFn: deleteActivity
    });

    // ── 本地 JSON 匯出入 ──────────────────────────────────────────────────────
    const handleExport = () => exportData(tickets, tripLabels, rawHotels, activities, tripBudgets, tripOverrides);
    const handleImport = (e) => {
        importData(e.target.files[0], (data) => {
            toast(`成功讀取 ${data.newTickets.length} 筆機票、${data.newHotels.length} 筆住宿、${data.newActivities.length} 筆活動`, {
                action: { label: '確認覆寫', onClick: () => {
                    setTickets(data.newTickets); setTripLabels(data.newLabels);
                    if (data.newBudgets) setTripBudgets(data.newBudgets);
                    // Always replace imported collections so users can intentionally clear existing data.
                    setHotels(Array.isArray(data.newHotels) ? data.newHotels : []);
                    setActivities(Array.isArray(data.newActivities) ? data.newActivities : []);
                    setOverrides(data.newOverrides || { version: 1, segTripId: {}, removedSegIds: [], tripOrder: [] });
                    toast.success('匯入成功！');
                }},
                cancel: { label: '取消', onClick: () => {} }, duration: 10000,
            });
        }, (err) => toast.error('匯入失敗', { description: err.message || '檔案格式錯誤或損毀。' }));
        e.target.value = '';
    };

    const handleCreateMagicLink = async () => {
        const toastId = toast.loading('正在產生 Magic Sync 同步連結...');
        try {
            const dataToShare = {
                tickets,
                tripLabels,
                hotels: rawHotels,
                activities,
                tripBudgets,
                tripOverrides
            };
            const id = await createMagicSyncSnapshot(dataToShare);
            const magicUrl = `${window.location.origin}${window.location.pathname}?magic=${id}`;
            await navigator.clipboard.writeText(magicUrl);
            toast.success('Magic Sync 連結已複製到剪貼簿！', {
                id: toastId,
                description: '請在另一台裝置開啟此連結以同步資料。',
                duration: 5000
            });
        } catch (err) {
            toast.error('無法產生同步連結', {
                id: toastId,
                description: err.message || '請檢查網路連線或 API 設定。'
            });
        }
    };

    useEffect(() => {
        const queryParams = new URLSearchParams(window.location.search);
        const magicId = queryParams.get('magic');
        if (!magicId) return;

        const loadMagicSync = async () => {
            const toastId = toast.loading('正在載入 Magic Sync 雲端資料...');
            try {
                const data = await fetchMagicSyncSnapshot(magicId);
                toast.dismiss(toastId);

                const countTickets = Array.isArray(data.tickets) ? data.tickets.length : 0;
                const countHotels = Array.isArray(data.hotels) ? data.hotels.length : 0;
                const countActivities = Array.isArray(data.activities) ? data.activities.length : 0;

                toast(`偵測到 Magic Sync 同步行程資料`, {
                    description: `包含 ${countTickets} 筆機票、${countHotels} 筆住宿、${countActivities} 筆活動。確認要覆寫目前的本地資料嗎？此動作無法復原。`,
                    action: {
                        label: '確認覆寫',
                        onClick: () => {
                            if (Array.isArray(data.tickets)) setTickets(data.tickets);
                            if (data.tripLabels) setTripLabels(data.tripLabels);
                            if (data.tripBudgets) setTripBudgets(data.tripBudgets);
                            setHotels(Array.isArray(data.hotels) ? data.hotels : []);
                            setActivities(Array.isArray(data.activities) ? data.activities : []);
                            setOverrides(data.tripOverrides || { version: 1, segTripId: {}, removedSegIds: [], tripOrder: [] });
                            toast.success('同步覆寫成功！');
                            
                            // 清除 URL 參數
                            const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
                            window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
                        }
                    },
                    cancel: {
                        label: '取消',
                        onClick: () => {
                            // 清除 URL 參數
                            const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
                            window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
                        }
                    },
                    duration: 15000,
                });
            } catch (err) {
                toast.error('無法載入 Magic Sync 資料', {
                    id: toastId,
                    description: err.message || '連結可能已過期或伺服器錯誤。'
                });
                // 清除 URL 參數，避免卡在錯誤狀態
                const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
                window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
            }
        };

        loadMagicSync();
    }, [setTickets, setTripLabels, setTripBudgets, setHotels, setActivities, setOverrides]);

    const ticketDomain = useMemo(() => ({
        tickets,
        setTickets,
        tripLabels,
        setTripLabels,
        tripBudgets,
        setTripBudgets,
        segments,
        trips,
        editingTicket,
        setEditingTicket,
        handleSaveTicket,
        handleEditTicket,
        handleCancelEdit,
        handleDeleteTicket,
    }), [
        tickets, setTickets, tripLabels, setTripLabels, tripBudgets, setTripBudgets,
        segments, trips,
        editingTicket, setEditingTicket,
        handleSaveTicket, handleEditTicket, handleCancelEdit, handleDeleteTicket,
    ]);

    const hotelDomain = useMemo(() => ({
        hotels,
        rawHotels,
        setHotels,
        updateHotelCalendarIds,
        editingHotel,
        handleSaveHotel,
        handleEditHotel,
        handleCancelEditHotel,
        handleDeleteHotel,
        isSavingHotel,
    }), [
        hotels, rawHotels, setHotels, updateHotelCalendarIds,
        editingHotel, handleSaveHotel, handleEditHotel,
        handleCancelEditHotel, handleDeleteHotel, isSavingHotel,
    ]);

    const activityDomain = useMemo(() => ({
        activities,
        setActivities,
        updateActivityCalendarId,
        editingActivity,
        handleSaveActivity,
        handleEditActivity,
        handleCancelEditActivity,
        handleDeleteActivity,
        isSavingActivity,
    }), [
        activities, setActivities, updateActivityCalendarId,
        editingActivity, handleSaveActivity, handleEditActivity,
        handleCancelEditActivity, handleDeleteActivity, isSavingActivity,
    ]);

    const overrideDomain = useMemo(() => ({
        tripOverrides,
        setOverrides,
        removeSegment,
        restoreSegment,
        moveSegmentToTrip,
        clearAllOverrides,
    }), [tripOverrides, setOverrides, removeSegment, restoreSegment, moveSegmentToTrip, clearAllOverrides]);

    const systemDomain = useMemo(() => ({
        exchangeRates,
        handleExport,
        handleImport,
        handleCreateMagicLink,
    }), [exchangeRates, handleExport, handleImport, handleCreateMagicLink]);

    const value = useMemo(() => ({
        // Structured domains
        ticketDomain,
        hotelDomain,
        activityDomain,
        overrideDomain,
        systemDomain,

        // Backward-compatible flat fields
        ...ticketDomain,
        ...hotelDomain,
        ...activityDomain,
        ...overrideDomain,
        ...systemDomain,
    }), [ticketDomain, hotelDomain, activityDomain, overrideDomain, systemDomain]);

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useDataContext() {
    return useContext(DataContext);
}

export function useTicketDataContext() {
    const data = useDataContext();
    return data.ticketDomain || {};
}

export function useHotelDataContext() {
    const data = useDataContext();
    return data.hotelDomain || {};
}

export function useActivityDataContext() {
    const data = useDataContext();
    return data.activityDomain || {};
}

export function useOverrideDataContext() {
    const data = useDataContext();
    return data.overrideDomain || {};
}

export function useSystemDataContext() {
    const data = useDataContext();
    return data.systemDomain || {};
}
