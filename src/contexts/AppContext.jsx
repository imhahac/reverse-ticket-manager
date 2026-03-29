import React, { createContext, useContext, useState, useRef, useMemo, useEffect } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { useGoogleSync } from '../hooks/useGoogleSync';
import { useExchangeRates } from '../hooks/useExchangeRates';
import { useItinerary } from '../hooks/useItinerary';
import { applyTripOverrides } from '../utils/tripOverrides';
import { useTrips } from '../hooks/useTrips';
import { useTripOverrides } from '../hooks/useTripOverrides';
import { useHotels } from '../features/hotels/hooks/useHotels';
import { useActivities } from '../hooks/useActivities';
import { useDecoratedTrips } from '../hooks/useDecoratedTrips';
import { useFilteredItems } from '../hooks/useFilteredItems';
import { validateConfig } from '../constants/config';
import { useEntityManager } from '../hooks/useEntityManager';
import { exportData, importData } from '../utils/importExportUtils';
import { toast } from 'sonner';

const AppContext = createContext();

export function AppProvider({ children }) {
    // ── 持久化資料 ───────────────────────────────────────────────────────────
    const [tickets, setTickets] = useLocalStorage('reverse-tickets', []);
    const [tripLabels, setTripLabels] = useLocalStorage('reverse-trip-labels', {});

    // ── UI 狀態 ──────────────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState('timeline');
    const [editingTicket, setEditingTicket] = useState(null);
    const [selectedHotelIdForMap, setSelectedHotelIdForMap] = useState(null);
    const [selectedTripIdForMap, setSelectedTripIdForMap] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [configWarnings, setConfigWarnings] = useState([]);
    const fileInputRef = useRef(null);

    // ── Auth & Sync Hooks ────────────────────────────────────────────────────
    const { accessToken, accessTokenState, login, logout, trySilentRefresh } = useGoogleAuth();
    const { exchangeRates } = useExchangeRates();

    // ── Flights Hooks ────────────────────────────────────────────────────────
    const { segments = [], trips = [] } = useTrips(Array.isArray(tickets) ? tickets : []);
    const { overrides: tripOverrides, removeSegment, restoreSegment, moveSegmentToTrip, clearAllOverrides } = useTripOverrides();

    // ── Hotels Hook ──────────────────────────────────────────────────────────
    const { hotels = [], rawHotels = [], addHotel, updateHotel, deleteHotel, updateHotelCalendarIds, setHotels } = useHotels();

    // ── Activities Hook ──────────────────────────────────────────────────────
    const { activities = [], setActivities, addActivity, updateActivity, deleteActivity, updateActivityCalendarId } = useActivities();

    // ── 組件掛載初始化 ────────────────────────────────────────────────────────
    useEffect(() => {
        const warnings = validateConfig();
        setConfigWarnings(warnings);
    }, []);

    // ── 地圖與行程連動邏輯 ────────────────────────────────────────────────────
    const handleSelectTripForMap = (tripId) => {
        setSelectedHotelIdForMap(null);
        setSelectedTripIdForMap(tripId);
        setActiveTab('map');
    };
    
    const handleSelectHotelForMap = (hotelId, tripId) => {
        setSelectedHotelIdForMap(hotelId);
        handleSelectTripForMap(tripId);
    };

    const handleClearSelectedTripForMap = () => {
        setSelectedTripIdForMap(null);
    };

    // ── Google Sync ──────────────────────────────────────────────────────────
    const { isSyncing, handleSyncToDrive, handleLoadFromDrive, handleSyncToCalendar } = useGoogleSync({
        accessToken, accessTokenState, trySilentRefresh, logout,
        tickets, tripLabels, setTickets, setTripLabels,
        hotels, rawHotels,
        activities,
        segments,
        setHotels,
        setActivities,
        updateHotelCalendarIds,
        updateActivityCalendarId,
    });

    // ── 衍生資料預運算 ────────────────────────────────────────────────────────
    const displayTrips = useMemo(() => applyTripOverrides(trips, tripOverrides), [trips, tripOverrides]);
    const { 
        decoratedTrips, totalPriceTWD, totalHotelTWD, totalActivityTWD, 
        pastCostTWD, futureCostTWD, totalTripDays, sunkCostTWD, 
        renderError, safeTickets, safeHotels, safeActivities 
    } = useDecoratedTrips(displayTrips, tickets, hotels, activities);

    const itinerary = useItinerary(
        Array.isArray(decoratedTrips) ? decoratedTrips : [],
        Array.isArray(hotels) ? hotels : [],
        Array.isArray(activities) ? activities : []
    );

    // ── 智慧搜尋與篩選引擎 ──────────────────────────────────────────────────
    const filteredTickets = useFilteredItems(safeTickets, searchTerm, filterStatus, 'tickets');
    const filteredHotels = useFilteredItems(safeHotels, searchTerm, filterStatus, 'hotels');
    const filteredActivities = useFilteredItems(safeActivities, searchTerm, filterStatus, 'activities');
    const filteredItinerary = useFilteredItems(itinerary, searchTerm, filterStatus, 'itinerary', tripLabels);

    const itineraryForMap = useMemo(() => {
        if (selectedTripIdForMap) return filteredItinerary.filter(trip => trip.id === selectedTripIdForMap);
        return filteredItinerary;
    }, [filteredItinerary, selectedTripIdForMap]);

    const hotelsForMap = useMemo(() => {
        if (selectedTripIdForMap && itineraryForMap.length > 0) {
            const tripHotelIds = new Set((itineraryForMap[0].matchedHotels ?? []).map(h => h.id));
            return filteredHotels.filter(hotel => tripHotelIds.has(hotel.id));
        }
        return filteredHotels;
    }, [filteredHotels, selectedTripIdForMap, itineraryForMap]);

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

    // 欲提供的資料
    const value = {
        // UI 狀態
        activeTab, setActiveTab,
        searchTerm, setSearchTerm,
        filterStatus, setFilterStatus,
        configWarnings, setConfigWarnings,
        fileInputRef,
        
        // 資料狀態與預算
        trips, safeTickets, safeHotels, safeActivities,
        filteredTickets, filteredHotels, filteredActivities, filteredItinerary,
        totalPriceTWD, totalHotelTWD, totalActivityTWD, 
        pastCostTWD, futureCostTWD, totalTripDays, sunkCostTWD, renderError,

        // 編輯狀態
        editingTicket, setEditingTicket, handleSaveTicket, handleEditTicket, handleCancelEdit, handleDeleteTicket,
        editingHotel, handleSaveHotel, handleEditHotel, handleCancelEditHotel, handleDeleteHotel, isSavingHotel,
        editingActivity, handleSaveActivity, handleEditActivity, handleCancelEditActivity, handleDeleteActivity, isSavingActivity,

        // Map 選項
        selectedHotelIdForMap, selectedTripIdForMap, itineraryForMap, hotelsForMap,
        handleSelectTripForMap, handleSelectHotelForMap, handleClearSelectedTripForMap,

        // 行程標籤與手動重組
        tripLabels, setTripLabels, tripOverrides, removeSegment, restoreSegment, moveSegmentToTrip, clearAllOverrides,

        // Auth & Sync
        accessToken, isSyncing, handleSyncToDrive, handleLoadFromDrive, handleSyncToCalendar, logout, login,
        
        // Export & rates
        handleExport, handleImport, exchangeRates
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
    return useContext(AppContext);
}
