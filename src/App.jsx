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
import React, { useState, useRef, useMemo } from 'react';
import { Plane, Calendar, Download, Upload, Cloud, CloudUpload, CloudDownload, LogOut, LogIn } from 'lucide-react';

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

// ── UI Components ──────────────────────────────────────────────────────────
import Instructions from './components/Instructions';
import Dashboard from './components/Dashboard';
import TripCalendar from './components/TripCalendar';
import TicketForm from './components/TicketForm';
import TicketList from './components/TicketList';
import TripTimeline from './components/TripTimeline';
import HotelForm from './features/hotels/components/HotelForm';
import HotelList from './features/hotels/components/HotelList';

function App() {
    // ── 持久化資料 ───────────────────────────────────────────────────────────
    const [tickets, setTickets] = useLocalStorage('reverse-tickets', []);
    const [tripLabels, setTripLabels] = useLocalStorage('reverse-trip-labels', {});

    // ── UI 狀態 ──────────────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState('timeline');
    const [editingTicket, setEditingTicket] = useState(null);
    const [editingHotel, setEditingHotel] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all'); // all, upcoming, warning
    const fileInputRef = useRef(null);

    // ── Auth & Sync Hooks ────────────────────────────────────────────────────
    const { accessToken, accessTokenState, login, logout, trySilentRefresh } = useGoogleAuth();
    const { exchangeRates } = useExchangeRates();

    // ── Flights Hooks ────────────────────────────────────────────────────────
    const { segments = [], trips = [] } = useTrips(tickets || []);
    const { overrides: tripOverrides, removeSegment, restoreSegment, moveSegmentToTrip, clearAllOverrides } = useTripOverrides();

    // ── Hotels Hook ──────────────────────────────────────────────────────────
    const { hotels = [], rawHotels = [], addHotel, updateHotel, deleteHotel, updateHotelCalendarIds, setHotels } = useHotels();

    // ── Google Sync ──────────────────────────────────────────────────────────
    const { isSyncing, handleSyncToDrive, handleLoadFromDrive, handleSyncToCalendar } = useGoogleSync({
        accessToken, accessTokenState, trySilentRefresh, logout,
        tickets, tripLabels, setTickets, setTripLabels,
        hotels, rawHotels,
        setHotels,
        updateHotelCalendarIds,
    });

    // ── 衍生資料：displayTrips → decoratedTrips → itinerary ─────────────────
    const displayTrips = useMemo(
        () => applyTripOverrides(trips, tripOverrides),
        [trips, tripOverrides]
    );

    const decoratedTrips = useMemo(() => {
        const now = Date.now();
        const getSegs = (trip) => {
            if (Array.isArray(trip.segments) && trip.segments.length > 0) return trip.segments;
            const s = [];
            if (trip.outbound) s.push(trip.outbound);
            if (Array.isArray(trip.connections)) s.push(...trip.connections);
            if (trip.inbound) s.push(trip.inbound);
            return s;
        };
        const dt = (date, time, fallback) => {
            if (!date) return null;
            const t = time || fallback;
            if (!t) return null;
            const d = new Date(`${date}T${t}:00`);
            return isNaN(d.getTime()) ? null : d;
        };
        return displayTrips.map(trip => {
            const segs = getSegs(trip);
            if (!segs.length) return { ...trip, segments: [], tripStartAt: null, tripEndAt: null, isPast: false, totalCostTWD: 0, isOpenJaw: false, tripDays: null, costPerDay: null };
            const first = segs[0], last = segs[segs.length - 1];
            const tripStartAt = dt(first.date, first.time, '00:00');
            const tripEndAt = dt(last.arrivalDate, last.arrivalTime, null)
                ?? (dt(last.date, last.time, null) ? new Date(dt(last.date, last.time, null).getTime() + 2 * 3600000) : null)
                ?? dt(last.date, '23:59', '23:59');
            const totalCostTWD = segs.reduce((s, seg) => {
                const base = seg.ticket?.priceTWD ?? seg.ticket?.price ?? 0;
                return s + (seg.ticket?.type === 'oneway' ? base : base / 2);
            }, 0);
            const isPast = tripEndAt ? tripEndAt.getTime() < now : false;
            const outCode = (first.to || '').split(' ')[0];
            const inCode  = (last.from || '').split(' ')[0];
            const isOpenJaw = segs.length >= 2 && Boolean(outCode && inCode && outCode !== inCode);
            const tripDays = (trip.isComplete && segs.length >= 2) ? calculateTripDays(first.date, last.date) : null;
            const costPerDay = (tripDays && tripDays > 0) ? Math.round(totalCostTWD / tripDays) : null;
            return { ...trip, segments: segs, tripStartAt, tripEndAt, isPast, totalCostTWD, isOpenJaw, tripDays, costPerDay };
        });
    }, [displayTrips]);

    // itinerary = decoratedTrips + 每個 trip 注入 matchedHotels
    const itinerary = useItinerary(decoratedTrips, hotels);

    // ── 費用計算 ─────────────────────────────────────────────────────────────
    const safeTickets = Array.isArray(tickets) ? tickets : [];
    const safeHotels  = Array.isArray(hotels) ? hotels : [];

    const totalPriceTWD  = safeTickets.reduce((s, t) => s + (t?.priceTWD || t?.price || 0), 0);
    const totalHotelTWD  = safeHotels.reduce((s, h) => s + (h?.priceTWD || 0), 0);
    const pastCostTWD    = useMemo(() => decoratedTrips.reduce((s, t) => s + ( t.isPast ? t.totalCostTWD : 0), 0), [decoratedTrips]);
    const futureCostTWD  = useMemo(() => decoratedTrips.reduce((s, t) => s + (!t.isPast ? t.totalCostTWD : 0), 0), [decoratedTrips]);
    const totalTripDays  = useMemo(() => decoratedTrips.reduce((s, t) => s + (t.tripDays || 0), 0), [decoratedTrips]);
    const sunkCostTWD    = Math.max(0, totalPriceTWD - pastCostTWD - futureCostTWD);

    // ── 智慧搜尋與篩選引擎 ──────────────────────────────────────────────────
    const searchLower = (searchTerm || '').toLowerCase();
    
    const filteredTickets = useMemo(() => {
        const safeTickets = Array.isArray(tickets) ? tickets : [];
        return safeTickets.filter(t => {
            if (!t) return false;
            const matchesSearch = !searchTerm || [t.airline, t.outboundFlightNo, t.inboundFlightNo, t.departRegion, t.returnRegion, t.note]
                .some(field => String(field || '').toLowerCase().includes(searchLower));
            
            if (filterStatus === 'upcoming') {
                return matchesSearch && new Date(t.outboundDate) >= new Date().setHours(0,0,0,0);
            }
            return matchesSearch;
        });
    }, [tickets, searchTerm, filterStatus]);

    const filteredHotels = useMemo(() => {
        const safeHotels = Array.isArray(hotels) ? hotels : [];
        return safeHotels.filter(h => {
            if (!h) return false;
            const matchesSearch = !searchTerm || [h.name, h.confirmationNo, h.address, h.note]
                .some(field => String(field || '').toLowerCase().includes(searchLower));
            
            if (filterStatus === 'upcoming') {
                return matchesSearch && new Date(h.checkIn) >= new Date().setHours(0,0,0,0);
            }
            return matchesSearch;
        });
    }, [hotels, searchTerm, filterStatus]);

    const filteredItinerary = useMemo(() => {
        return itinerary.filter(trip => {
            if (!trip) return false;
            // 1. 搜尋比對 (Label, 機場, 航班)
            const segments = trip.segments || [];
            const customLabel = (tripLabels && trip.id) ? (tripLabels[trip.id] || '') : '';
            const matchesSearch = !searchTerm || [
                customLabel,
                ...segments.map(s => s?.from),
                ...segments.map(s => s?.to),
                ...segments.map(s => s?.flightNo),
                ...segments.map(s => s?.ticket?.airline)
            ].some(field => String(field || '').toLowerCase().includes(searchLower));

            // 2. 狀態比對
            if (filterStatus === 'upcoming') return matchesSearch && !trip.isPast;
            if (filterStatus === 'warning') return matchesSearch && trip.hasWarning;
            
            return matchesSearch;
        });
    }, [itinerary, searchTerm, filterStatus, tripLabels]);

    // ── 機票 CRUD ─────────────────────────────────────────────────────────────
    const handleSaveTicket = (ticket) => {
        setTickets(prev => editingTicket
            ? prev.map(t => t.id === ticket.id ? ticket : t)
            : [...prev, ticket]);
        setEditingTicket(null);
    };
    const handleEditTicket = (ticket) => { setEditingTicket(ticket); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    const handleCancelEdit = () => setEditingTicket(null);

    // ── 飯店 CRUD ─────────────────────────────────────────────────────────────
    const handleSaveHotel = (hotel) => {
        if (editingHotel) {
            updateHotel(hotel);
        } else {
            addHotel(hotel);
        }
        setEditingHotel(null);
    };
    const handleEditHotel = (hotel) => { setEditingHotel(hotel); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    const handleDeleteHotel = (id) => {
        import('sonner').then(({ toast }) =>
            toast('確定要刪除這筆住宿記錄嗎？', {
                action: { label: '確認刪除', onClick: () => deleteHotel(id) },
                cancel: { label: '取消', onClick: () => {} },
                duration: 8000,
            })
        );
    };

    // ── 本地 JSON 匯出入 ──────────────────────────────────────────────────────
    const handleExport = () => {
        const blob = new Blob([JSON.stringify({ tickets, tripLabels, hotels: rawHotels }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        Object.assign(document.createElement('a'), {
            href: url,
            download: `travel-backup-${new Date().toISOString().split('T')[0]}.json`,
        }).click();
        URL.revokeObjectURL(url);
    };

    const handleImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ({ target }) => {
            try {
                const data = JSON.parse(target.result);
                const newTickets = Array.isArray(data) ? data : (data.tickets || []);
                const newLabels  = data.tripLabels || {};
                const newHotels  = data.hotels || [];
                if (!newTickets.length || !newTickets[0]?.id) throw new Error('Invalid format');
                import('sonner').then(({ toast }) =>
                    toast(`成功讀取 ${newTickets.length} 筆機票、${newHotels.length} 筆住宿`, {
                        action: { label: '確認覆寫', onClick: () => {
                            setTickets(newTickets);
                            setTripLabels(newLabels);
                            if (newHotels.length > 0) setHotels(newHotels);
                            toast.success('匯入成功！');
                        }},
                        cancel: { label: '取消', onClick: () => {} },
                        duration: 10000,
                    })
                );
            } catch {
                import('sonner').then(({ toast }) => toast.error('匯入失敗', { description: '檔案格式錯誤或損毀。' }));
            }
            e.target.value = '';
        };
        reader.readAsText(file);
    };

    // ── Tab 設定 ──────────────────────────────────────────────────────────────
    const TABS = [
        { key: 'timeline', label: '📆 行程 Timeline' },
        { key: 'list',     label: '🎟️ 機票管理' },
        { key: 'hotels',   label: '🏨 飯店管理' },
        { key: 'calendar', label: '📅 月曆' },
    ];

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen p-4 md:p-8 bg-slate-50 text-slate-800 font-sans selection:bg-indigo-100 selection:text-indigo-900 pb-24 md:pb-8">
            <div className="max-w-5xl mx-auto">

                {/* ── Header ─────────────────────────────────────────────── */}
                <header className="mb-8 pt-4 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-3 tracking-tight flex items-center">
                            <Plane className="w-8 h-8 mr-3 text-indigo-600" /> 差旅行程管理系統
                        </h1>
                        <p className="text-slate-500 text-lg">機票反向防呆 ✈️ + 飯店住宿管理 🏨 一站整合</p>
                    </div>
                    <div className="flex flex-col gap-2 w-full md:w-auto">
                        {accessToken ? (
                            <div className="flex flex-wrap gap-2 justify-end bg-indigo-50 p-2 rounded-lg border border-indigo-100">
                                <span className="flex items-center text-xs font-bold text-indigo-600 w-full mb-1">
                                    <Cloud className="w-3 h-3 mr-1" /> 已連結 Google (Drive &amp; Calendar)
                                </span>
                                <button onClick={handleSyncToDrive} disabled={isSyncing} className="flex items-center px-3 py-1.5 bg-white border border-indigo-200 text-indigo-700 font-bold text-sm rounded shadow-sm hover:bg-indigo-50 transition min-w-[120px] justify-center disabled:opacity-50">
                                    <CloudUpload className="w-4 h-4 mr-1.5" /> 雲端備份
                                </button>
                                <button onClick={handleLoadFromDrive} disabled={isSyncing} className="flex items-center px-3 py-1.5 bg-white border border-indigo-200 text-indigo-700 font-bold text-sm rounded shadow-sm hover:bg-indigo-50 transition min-w-[120px] justify-center disabled:opacity-50">
                                    <CloudDownload className="w-4 h-4 mr-1.5" /> 雲端載入
                                </button>
                                <button onClick={handleSyncToCalendar} disabled={isSyncing} className="flex items-center px-3 py-1.5 bg-indigo-600 border border-indigo-700 text-white font-bold text-sm rounded shadow-sm hover:bg-indigo-700 transition min-w-[120px] justify-center disabled:opacity-50">
                                    <Calendar className="w-4 h-4 mr-1.5" /> 同步日曆
                                </button>
                                <button onClick={logout} disabled={isSyncing} className="flex items-center px-3 py-1.5 bg-gray-100 border border-gray-200 text-gray-600 font-bold text-sm rounded shadow-sm hover:bg-gray-200 transition">
                                    <LogOut className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-2 justify-end border p-2 rounded-lg bg-white border-gray-200 shadow-sm">
                                <button onClick={() => login()} className="flex items-center px-4 py-2 bg-indigo-600 text-white font-bold text-sm rounded hover:bg-indigo-700 transition">
                                    <LogIn className="w-4 h-4 mr-2" /> 登入 Google 啟用雲端功能
                                </button>
                            </div>
                        )}
                        <div className="flex gap-2 justify-end mt-1">
                            <button onClick={handleExport} className="flex items-center px-3 py-1.5 bg-white border border-gray-200 text-gray-500 font-bold text-xs rounded hover:bg-gray-50 transition">
                                <Download className="w-3 h-3 mr-1" /> 本地匯出 JSON
                            </button>
                            <button onClick={() => fileInputRef.current?.click()} className="flex items-center px-3 py-1.5 bg-white border border-gray-200 text-gray-500 font-bold text-xs rounded hover:bg-gray-50 transition">
                                <Upload className="w-3 h-3 mr-1" /> 本地匯入 JSON
                            </button>
                            <input type="file" accept=".json" ref={fileInputRef} className="hidden" onChange={handleImport} />
                        </div>
                    </div>
                </header>

                <Instructions />

                {/* ── Dashboard ──────────────────────────────────────────── */}
                <Dashboard
                    ticketCount={tickets.length}
                    tripCount={trips.length}
                    hotelCount={hotels.length}
                    totalPriceTWD={totalPriceTWD}
                    totalHotelTWD={totalHotelTWD}
                    futureCostTWD={futureCostTWD}
                    pastCostTWD={pastCostTWD}
                    sunkCostTWD={sunkCostTWD}
                    totalTripDays={totalTripDays}
                />

                {/* ── 智慧篩選列 ─────────────────────────────────────────── */}
                <div className="mb-6 flex flex-col md:flex-row gap-3 items-center bg-white p-3 rounded-xl shadow-sm border border-slate-200">
                    <div className="relative flex-1 w-full">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                        <input 
                            type="text" 
                            placeholder="搜尋航班、機場、飯店或自訂名稱..."
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-full md:w-auto">
                        {[
                            { key: 'all', label: '全部' },
                            { key: 'upcoming', label: '未來' },
                            { key: 'warning', label: '⚠️ 警告' }
                        ].map(opt => (
                            <button
                                key={opt.key}
                                onClick={() => setFilterStatus(opt.key)}
                                className={`flex-1 md:flex-none px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                                    filterStatus === opt.key 
                                        ? 'bg-white text-indigo-600 shadow-sm' 
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Tab 內容（表單跟著 active tab 變化）─────────────────── */}
                {activeTab === 'timeline' || activeTab === 'list' ? (
                    <TicketForm
                        onAddTicket={handleSaveTicket}
                        editingTicket={editingTicket}
                        onCancelEdit={handleCancelEdit}
                        exchangeRates={exchangeRates}
                    />
                ) : activeTab === 'hotels' ? (
                    <HotelForm
                        onSaveHotel={handleSaveHotel}
                        editingHotel={editingHotel}
                        onCancelEdit={() => setEditingHotel(null)}
                        exchangeRates={exchangeRates}
                    />
                ) : null}

                {/* ── 主視覺 Tab (Desktop) ─────────────────────────────────────────── */}
                <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="hidden md:flex border-b border-gray-200 p-1 bg-slate-50/50">
                        {TABS.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex-1 py-3 px-3 font-bold text-sm rounded-t-lg transition-colors ${
                                    activeTab === tab.key
                                        ? 'bg-white text-indigo-700 border-b-2 border-indigo-500 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <div className="p-4 md:p-6 bg-white min-h-[400px]">
                        {activeTab === 'timeline' && (
                            <TripTimeline
                                trips={filteredItinerary}
                                tripLabels={tripLabels}
                                onUpdateLabel={(id, val) => setTripLabels(p => ({ ...p, [id]: val }))}
                                overrideState={tripOverrides}
                                onRemoveSegment={removeSegment}
                                onRestoreSegment={restoreSegment}
                                onMoveSegmentToTrip={moveSegmentToTrip}
                                onClearAllOverrides={clearAllOverrides}
                            />
                        )}
                        {activeTab === 'list' && (
                            <TicketList tickets={filteredTickets} onDelete={(id) => {
                                import('sonner').then(({ toast }) =>
                                    toast('確定要刪除這筆機票訂單嗎？', {
                                        description: '相關的趟次配對將會被移除。',
                                        action: { label: '確認刪除', onClick: () => setTickets(prev => prev.filter(t => t.id !== id)) },
                                        cancel: { label: '取消', onClick: () => {} },
                                        duration: 8000,
                                    })
                                );
                            }} onEdit={handleEditTicket} />
                        )}
                        {activeTab === 'hotels' && (
                            <HotelList
                                hotels={filteredHotels}
                                onEdit={handleEditHotel}
                                onDelete={handleDeleteHotel}
                            />
                        )}
                        {activeTab === 'calendar' && <TripCalendar trips={itinerary} tripLabels={tripLabels} />}
                    </div>
                </div>

                <footer className="mt-12 text-center text-sm text-gray-400 pb-4 md:pb-8 hidden md:block">
                    &copy; {new Date().getFullYear()} Travel Itinerary Planner. Data stored locally.
                </footer>
            </div>

            {/* ── Bottom Navigation Bar (Mobile) ───────────────────────── */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center px-2 py-2 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-50">
                {TABS.map(tab => {
                    const isActive = activeTab === tab.key;
                    /* extract the emoji and text from the label */
                    const [emoji, ...textParts] = tab.label.split(' ');
                    const text = textParts.join(' ');
                    
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex flex-col items-center justify-center w-full py-1 ${
                                isActive ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            <span className={`text-xl mb-1 ${isActive ? 'scale-110' : 'grayscale opacity-70'} transition-transform`}>{emoji}</span>
                            <span className={`text-[10px] font-bold ${isActive ? 'font-black' : ''}`}>{text}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export default App;
