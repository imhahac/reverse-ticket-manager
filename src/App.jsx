/**
 * App.jsx ── 應用程式根元件（Travel Itinerary Planner）
 *
 * 職責：只做 layout glue，所有業務邏輯分散在各 Hook / Feature 模組。
 *
 * 架構層次：
 *   Hooks（資料層）
 *     useGoogleAuth       ← OAuth login / logout / silent refresh
 *     useGoogleSync       ← Drive 備份 / Calendar 同步
 *     useExchangeRates    ← 即時匯率
 *     useLocalStorage     ← tickets / tripLabels 持久化
 *     useTrips            ← 拆票＋配對 → segments / trips
 *     useTripOverrides    ← 手動重組持久化
 *
 *   useMemo（衍生資料層）
 *     displayTrips    ← applyTripOverrides(trips, overrides)
 *     decoratedTrips  ← isPast / totalCostTWD / isOpenJaw / tripDays / costPerDay
 *
 *   UI 元件（純渲染）
 *     Dashboard       ← 統計卡片
 *     GoogleToolbar   ← header 右側按鈕組（inline）
 *     TripTimeline / TicketList / TripCalendar / TicketForm / Instructions
 *
 * Features（功能模組，各自獨立）
 *     features/flights/   ← 現有機票功能
 *     features/hotels/    ← 飯店住宿（骨架，待實作）
 */
import React, { useState, useRef, useMemo } from 'react';
import { Plane, Calendar, Download, Upload, Cloud, CloudUpload, CloudDownload, LogOut, LogIn } from 'lucide-react';


// ── Hooks ──────────────────────────────────────────────────────────────────
import { useLocalStorage } from './hooks/useLocalStorage';
import { useGoogleAuth } from './hooks/useGoogleAuth';
import { useGoogleSync } from './hooks/useGoogleSync';
import { useExchangeRates } from './hooks/useExchangeRates';
import { calculateTripDays } from './utils/dateHelpers';
import { applyTripOverrides } from './utils/tripOverrides';

// ── Features: Flights ──────────────────────────────────────────────────────
import { useTrips } from './hooks/useTrips';
import { useTripOverrides } from './hooks/useTripOverrides';

// ── UI Components ──────────────────────────────────────────────────────────
import Instructions from './components/Instructions';
import Dashboard from './components/Dashboard';
import TripCalendar from './components/TripCalendar';
import TicketForm from './components/TicketForm';
import TicketList from './components/TicketList';
import TripTimeline from './components/TripTimeline';

function App() {
    // ── 持久化資料 ───────────────────────────────────────────────────────────
    const [tickets, setTickets] = useLocalStorage('reverse-tickets', []);
    const [tripLabels, setTripLabels] = useLocalStorage('reverse-trip-labels', {});

    // ── UI 狀態 ──────────────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState('timeline');
    const [editingTicket, setEditingTicket] = useState(null);
    const fileInputRef = useRef(null);

    // ── Hooks ─────────────────────────────────────────────────────────────────
    const { accessToken, accessTokenState, login, logout, trySilentRefresh } = useGoogleAuth();
    const { exchangeRates } = useExchangeRates();
    const { segments, trips } = useTrips(tickets);
    const { overrides: tripOverrides, removeSegment, restoreSegment, moveSegmentToTrip, clearAllOverrides } = useTripOverrides();
    const { isSyncing, handleSyncToDrive, handleLoadFromDrive, handleSyncToCalendar } = useGoogleSync({
        accessToken, accessTokenState, trySilentRefresh, logout,
        tickets, tripLabels, setTickets, setTripLabels,
    });

    // ── 衍生資料層 ────────────────────────────────────────────────────────────
    const displayTrips = useMemo(() => applyTripOverrides(trips, tripOverrides), [trips, tripOverrides]);

    /**
     * decoratedTrips：為每個 trip 補充衍生欄位。
     * TripTimeline 直接讀取這些欄位，不再自行計算。
     *
     * 欄位說明：
     *   tripStartAt / tripEndAt → 判斷 isPast 用
     *   isPast                  → tripEndAt < now
     *   totalCostTWD            → 各航段分攤成本加總
     *   isOpenJaw               → 去回程機場不同
     *   tripDays                → 含頭含尾天數
     *   costPerDay              → totalCostTWD / tripDays
     */
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
            let tripEndAt = dt(last.arrivalDate, last.arrivalTime, null)
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

    // ── 費用三分類 ────────────────────────────────────────────────────────────
    const totalPriceTWD = tickets.reduce((s, t) => s + (t.priceTWD || t.price), 0);
    const pastCostTWD   = useMemo(() => decoratedTrips.reduce((s, t) => s + (t.isPast  ? t.totalCostTWD : 0), 0), [decoratedTrips]);
    const futureCostTWD = useMemo(() => decoratedTrips.reduce((s, t) => s + (!t.isPast ? t.totalCostTWD : 0), 0), [decoratedTrips]);
    const sunkCostTWD   = Math.max(0, totalPriceTWD - pastCostTWD - futureCostTWD);

    // ── 機票 CRUD handlers ────────────────────────────────────────────────────
    const handleSaveTicket = (ticket) => {
        setTickets(prev => editingTicket
            ? prev.map(t => t.id === ticket.id ? ticket : t)
            : [...prev, ticket]);
        setEditingTicket(null);
    };
    const handleEditTicket = (ticket) => { setEditingTicket(ticket); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    const handleCancelEdit = () => setEditingTicket(null);

    // importTicket 的 toast confirm 在 useGoogleSync 外（本地 JSON 匯入）
    const handleExport = () => {
        const blob = new Blob([JSON.stringify({ tickets, tripLabels }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        Object.assign(document.createElement('a'), {
            href: url,
            download: `reverse-tickets-backup-${new Date().toISOString().split('T')[0]}.json`,
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
                if (!newTickets.length || !newTickets[0]?.id) throw new Error('Invalid format');
                import('sonner').then(({ toast }) =>
                    toast(`成功讀取 ${newTickets.length} 筆機票資料`, {
                        description: '確認後將覆寫目前所有訂單。',
                        action: { label: '確認覆寫', onClick: () => { setTickets(newTickets); setTripLabels(newLabels); toast.success('匯入成功！'); } },
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

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen p-4 md:p-8 bg-slate-50 text-slate-800 font-sans selection:bg-indigo-100 selection:text-indigo-900">
            <div className="max-w-5xl mx-auto">

                {/* ── Header ─────────────────────────────────────────────── */}
                <header className="mb-8 pt-4 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-3 tracking-tight flex items-center">
                            <Plane className="w-8 h-8 mr-3 text-indigo-600" /> 航班反向票管理系統
                        </h1>
                        <p className="text-slate-500 text-lg">解決來回機票分段購買時，出發方向與日期混淆的問題。</p>
                    </div>
                    <div className="flex flex-col gap-2 w-full md:w-auto">
                        {/* Google 雲端按鈕 */}
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
                        {/* 本地 JSON 匯出入 */}
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
                    totalPriceTWD={totalPriceTWD}
                    futureCostTWD={futureCostTWD}
                    pastCostTWD={pastCostTWD}
                    sunkCostTWD={sunkCostTWD}
                />

                {/* ── 機票新增/修改表單 ───────────────────────────────────── */}
                <TicketForm
                    onAddTicket={handleSaveTicket}
                    editingTicket={editingTicket}
                    onCancelEdit={handleCancelEdit}
                    exchangeRates={exchangeRates}
                />

                {/* ── 主視覺 Tab 切換 ─────────────────────────────────────── */}
                <div className="mt-12 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="flex border-b border-gray-200 p-1 bg-slate-50/50">
                        {[
                            { key: 'timeline', label: '📆 實際飛行配對 (Timeline)' },
                            { key: 'list',     label: '🎟️ 購買清單管理 (Purchases)' },
                            { key: 'calendar', label: '📅 月曆視角 (Calendar)' },
                        ].map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex-1 py-3 px-2 sm:px-4 font-bold text-sm sm:text-base rounded-t-lg transition-colors ${
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
                                trips={decoratedTrips}
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
                            <TicketList tickets={tickets} onDelete={(id) => {
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
                        {activeTab === 'calendar' && <TripCalendar segments={segments} />}
                    </div>
                </div>

                <footer className="mt-12 text-center text-sm text-gray-400 pb-8">
                    &copy; {new Date().getFullYear()} Travel Itinerary Planner. Data stored locally.
                </footer>
            </div>
        </div>
    );
}

export default App;
