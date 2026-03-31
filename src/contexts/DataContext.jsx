import React, { createContext, useContext, useState } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useExchangeRates } from '../hooks/useExchangeRates';
import { useTrips } from '../hooks/useTrips';
import { useTripOverrides } from '../hooks/useTripOverrides';
import { useHotels } from '../features/hotels/hooks/useHotels';
import { useActivities } from '../hooks/useActivities';
import { useEntityManager } from '../hooks/useEntityManager';
import { exportData, importData } from '../utils/importExportUtils';
import { toast } from 'sonner';

export const DataContext = createContext();

export function DataProvider({ children }) {
    // ── 持久化資料 ───────────────────────────────────────────────────────────
    const [tickets, setTickets] = useLocalStorage('reverse-tickets', []);
    const [tripLabels, setTripLabels] = useLocalStorage('reverse-trip-labels', {});

    // ── UI 狀態 (僅保留表單編輯狀態) ──────────────────────────────────────────
    const [editingTicket, setEditingTicket] = useState(null);

    // ── 原始資料 Hooks ──────────────────────────────────────────────────────
    const { exchangeRates } = useExchangeRates();
    const { segments = [], trips = [] } = useTrips(Array.isArray(tickets) ? tickets : []);
    const { overrides: tripOverrides, removeSegment, restoreSegment, moveSegmentToTrip, clearAllOverrides } = useTripOverrides();
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
    const handleExport = () => exportData(tickets, tripLabels, rawHotels, activities);
    const handleImport = (e) => {
        importData(e.target.files[0], (data) => {
            toast(`成功讀取 ${data.newTickets.length} 筆機票、${data.newHotels.length} 筆住宿、${data.newActivities.length} 筆活動`, {
                action: { label: '確認覆寫', onClick: () => {
                    setTickets(data.newTickets); setTripLabels(data.newLabels);
                    if (data.newHotels.length > 0) setHotels(data.newHotels);
                    if (data.newActivities.length > 0) setActivities(data.newActivities);
                    toast.success('匯入成功！');
                }},
                cancel: { label: '取消', onClick: () => {} }, duration: 10000,
            });
        }, (err) => toast.error('匯入失敗', { description: err.message || '檔案格式錯誤 or 損毀。' }));
        e.target.value = '';
    };

    const value = {
        // Raw Data & Source Hooks
        tickets, setTickets, 
        tripLabels, setTripLabels,
        hotels, rawHotels, setHotels, updateHotelCalendarIds,
        activities, setActivities, updateActivityCalendarId,
        segments, trips, tripOverrides,
        exchangeRates,
        
        // CRUD Handlers
        editingTicket, setEditingTicket, handleSaveTicket, handleEditTicket, handleCancelEdit, handleDeleteTicket,
        editingHotel, handleSaveHotel, handleEditHotel, handleCancelEditHotel, handleDeleteHotel, isSavingHotel,
        editingActivity, handleSaveActivity, handleEditActivity, handleCancelEditActivity, handleDeleteActivity, isSavingActivity,

        // Overrides Handlers
        removeSegment, restoreSegment, moveSegmentToTrip, clearAllOverrides,

        handleExport, handleImport
    };

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useDataContext() {
    return useContext(DataContext);
}
