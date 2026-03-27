/**
 * App.jsx ── 應用程式根元件（Travel Itinerary Planner v2）
 *
 * 架構層次：
 *   Hooks（資料層）
 *     useGoogleAuth       ← OAuth
 *     useGoogleSync       ← Drive / Calendar 同步
 *     useExchangeRates    ← 即時匯率
 *     useLocalStorage     ← tickets / tripLabels 持久化
 *     useTrips            ← 航班配對 → segments / trips
 *     useTripOverrides    ← 手動重組
 *     useHotels           ← 飯店 CRUD + 衍生欄位
 *
 *   useMemo（衍生資料層）
 *     displayTrips    ← applyTripOverrides(trips, overrides)
 *     decoratedTrips  ← 航班成本 / isOpenJaw / tripDays 計算
 *     itinerary       ← useItinerary(decoratedTrips, hotels) → 注入 matchedHotels
 *
 *   UI 元件（純渲染）
 *     Dashboard / TicketForm / HotelForm / TripTimeline / TicketList / HotelList / TripCalendar / Instructions
 *
 * Tabs：
 *   📆 Timeline（機票 + 飯店混排）
 *   🎟️ 機票管理
 *   🏨 飯店管理
 *   📅 月曆
 */
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Plane, Calendar, Download, Upload, Cloud, CloudUpload, CloudDownload, LogOut, LogIn, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

// ── Hooks ──────────────────────────────────────────────────────────────────
import { useLocalStorage } from './hooks/useLocalStorage';
import { useGoogleAuth } from './hooks/useGoogleAuth';
import { useGoogleSync } from './hooks/useGoogleSync';
import { useExchangeRates } from './hooks/useExchangeRates';
import { useItinerary } from './hooks/useItinerary';
import { calculateTripDays } from './utils/dateHelpers';
import { applyTripOverrides } from './utils/tripOverrides';
import { useTrips } from './hooks/useTrips';
import { useTripOverrides } from './hooks/useTripOverrides';
import { useHotels } from './features/hotels/hooks/useHotels';
import { useActivities } from './hooks/useActivities';

import { useDecoratedTrips } from './hooks/useDecoratedTrips';
import { useFilteredItems } from './hooks/useFilteredItems';
import { exportData, importData } from './utils/importExportUtils';
import { validateConfig } from './constants/config';
import { useEntityManager } from './hooks/useEntityManager';

// ── UI Components ──────────────────────────────────────────────────────────
import Instructions from './components/Instructions';
import Dashboard from './components/Dashboard';
import TicketForm from './components/TicketForm';
import HotelForm from './features/hotels/components/HotelForm';
import ActivityForm from './components/ActivityForm';
import AppHeader from './components/AppHeader';
import BottomNav from './components/BottomNav';
import SearchFilterBar from './components/SearchFilterBar';
import TabContent from './components/TabContent';

// ── Constants ──────────────────────────────────────────────────────────────
const TABS = [
    { key: 'timeline', label: '📆 行程 Timeline' },
    { key: 'list',     label: '🎟️ 機票管理' },
    { key: 'hotels',   label: '🏨 飯店管理' },
    { key: 'activities', label: '🎫 票卷與活動' },
    { key: 'calendar', label: '📅 月曆' },
    { key: 'map',      label: '🗺️ 地圖' },
];

function App() {
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
    const { segments = [], trips = [] } = useTrips(tickets || []);
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

    if (renderError) {
        return (
            <div className="min-h-screen p-8 flex items-center justify-center bg-slate-50">
                <div className="max-w-md w-full bg-white p-6 rounded-2xl shadow-xl border border-red-100 text-center">
                    <div className="text-5xl mb-4">😵</div>
                    <h1 className="text-xl font-bold text-slate-800 mb-2">程式發生非預期錯誤</h1>
                    <p className="text-sm text-slate-500 mb-6">這通常是因為瀏覽器儲存的資料格式損毀所致。我們建議您重設資料後重新載入。</p>
                    <div className="bg-red-50 p-3 rounded-lg mb-6 text-left">
                        <p className="text-[10px] font-mono text-red-600 break-all leading-tight">Error: {renderError}</p>
                    </div>
                    <div className="flex flex-col gap-3">
                        <button onClick={() => window.location.reload()} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition">重新整理網頁</button>
                        <button onClick={() => { if (confirm('確定要清除所有本地資料嗎？')) { localStorage.clear(); window.location.reload(); } }} className="w-full py-3 bg-white border border-red-200 text-red-600 font-bold rounded-lg hover:bg-red-50 transition">⚠️ 強制清除資料並重設</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
            {configWarnings.length > 0 && (
                <div className="bg-amber-50 border-b border-amber-200 p-3 shadow-sm">
                    <div className="container mx-auto px-4 flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                        <div className="flex-1 text-xs font-bold text-amber-800">
                            系統配置未完成：<span className="font-normal ml-1">{configWarnings.join(' ')}</span>
                        </div>
                        <button onClick={() => setConfigWarnings([])} className="text-amber-400 hover:text-amber-600">&times;</button>
                    </div>
                </div>
            )}

            <div className="max-w-5xl mx-auto p-4 md:p-8">
                <AppHeader accessToken={accessToken} isSyncing={isSyncing} handleSyncToDrive={handleSyncToDrive} handleLoadFromDrive={handleLoadFromDrive} handleSyncToCalendar={handleSyncToCalendar} logout={logout} login={login} handleExport={handleExport} fileInputRef={fileInputRef} handleImport={handleImport} />
                <Instructions />
                <Dashboard ticketCount={safeTickets.length} tripCount={trips.length} hotelCount={safeHotels.length} activityCount={safeActivities.length} totalPriceTWD={totalPriceTWD} totalHotelTWD={totalHotelTWD} totalActivityTWD={totalActivityTWD} futureCostTWD={futureCostTWD} pastCostTWD={pastCostTWD} sunkCostTWD={sunkCostTWD} totalTripDays={totalTripDays} />

                <SearchFilterBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} filterStatus={filterStatus} setFilterStatus={setFilterStatus} />

                {activeTab === 'timeline' || activeTab === 'list' 
                    ? <TicketForm onAddTicket={handleSaveTicket} editingTicket={editingTicket} onCancelEdit={handleCancelEdit} exchangeRates={exchangeRates} />
                    : activeTab === 'hotels' 
                    ? <HotelForm onSaveHotel={handleSaveHotel} editingHotel={editingHotel} onCancelEdit={handleCancelEditHotel} exchangeRates={exchangeRates} isSaving={isSavingHotel} />
                    : activeTab === 'activities' 
                    ? <ActivityForm onSaveActivity={handleSaveActivity} editingActivity={editingActivity} onCancelEdit={handleCancelEditActivity} exchangeRates={exchangeRates} isSaving={isSavingActivity} />
                    : null
                }

                <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="hidden md:flex border-b border-gray-200 p-1 bg-slate-50/50">
                        {TABS.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex-1 py-3 px-3 font-bold text-sm rounded-t-lg transition-colors ${activeTab === tab.key ? 'bg-white text-indigo-700 border-b-2 border-indigo-500 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <div className="p-4 md:p-6 bg-white min-h-[400px]">
                        <TabContent
                            activeTab={activeTab}
                            filteredItinerary={filteredItinerary}
                            tripLabels={tripLabels}
                            setTripLabels={setTripLabels}
                            tripOverrides={tripOverrides}
                            removeSegment={removeSegment}
                            restoreSegment={restoreSegment}
                            moveSegmentToTrip={moveSegmentToTrip}
                            clearAllOverrides={clearAllOverrides}
                            handleSelectHotelForMap={handleSelectHotelForMap}
                            handleSelectTripForMap={handleSelectTripForMap}
                            filteredTickets={filteredTickets}
                            handleDeleteTicket={handleDeleteTicket}
                            handleEditTicket={handleEditTicket}
                            filteredHotels={filteredHotels}
                            handleEditHotel={handleEditHotel}
                            handleDeleteHotel={handleDeleteHotel}
                            filteredActivities={filteredActivities}
                            handleEditActivity={handleEditActivity}
                            handleDeleteActivity={handleDeleteActivity}
                            itineraryForMap={itineraryForMap}
                            hotelsForMap={hotelsForMap}
                            handleClearSelectedTripForMap={handleClearSelectedTripForMap}
                            selectedHotelIdForMap={selectedHotelIdForMap}
                            selectedTripIdForMap={selectedTripIdForMap}
                        />
                    </div>
                </div>

                <footer className="mt-12 text-center text-sm text-gray-400 pb-4 md:pb-8 hidden md:block">
                    &copy; {new Date().getFullYear()} Travel Itinerary Planner. Data stored locally.
                </footer>
            </div>
            <BottomNav TABS={TABS} activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>
    );
}

export default App;
