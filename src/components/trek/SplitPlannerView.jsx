import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    Calendar, 
    MapPin, 
    Plus, 
    FileText, 
    Ticket, 
    Utensils, 
    Hotel, 
    Plane, 
    Maximize2, 
    Minimize2,
    Map as MapIcon,
    ListFilter,
    Sparkles,
    Edit2,
    Trash2,
    Archive,
    ArchiveRestore,
    Share2,
    Download,
    X
} from 'lucide-react';
import { useTrek } from '../../contexts/TrekContext';
import { getTripStatus, isTripArchivedOrEnded } from '../../services/trips/tripStatusService';
import DayPlanTimeline from './DayPlanTimeline';
import MapLibreView from './MapLibreView';
import ReservationManager from './ReservationManager';
import TripTimeline from '../TripTimeline';
import ShareButton from '../ShareButton';
import { useFilterContext } from '../../contexts/FilterContext';
import { useUIContext } from '../../contexts/UIContext';
import {
    useTicketDataContext,
    useHotelDataContext,
    useActivityDataContext,
    useOverrideDataContext,
} from '../../contexts/DataContext';
import { getUnifiedReservations } from '../../services/reservations/unifiedReservationService';
import { placeItemRepo } from '../../services/db';

export default function SplitPlannerView({ defaultSubTab = 'daily' }) {
    const { 
        activeTrip, reservations, dayPlans, viewMode, setViewMode, updateTrip, deleteTrip, toggleArchiveTrip, trips,
        isSharedView, importSharedTripToLocal, exitSharedView
    } = useTrek();
    const { activeTab } = useUIContext();

    // 智能雙欄的子視圖由 activeTab 同步驅動：'daily' | 'timeline' | 'reservations'
    const currentSubTab = useMemo(() => {
        if (activeTab === 'timeline') return 'timeline';
        if (activeTab === 'reservations') return 'reservations';
        if (activeTab === 'planner') return 'daily';
        return defaultSubTab;
    }, [activeTab, defaultSubTab]);
    const [mobileActiveView, setMobileActiveView] = useState('planner'); // 'planner' | 'map'
    const [selectedPlaces, setSelectedPlaces] = useState([]);
    const [routeGeometry, setRouteGeometry] = useState(null);

    // 旅程編輯 Modal 狀態
    const [isEditTripModalOpen, setIsEditTripModalOpen] = useState(false);
    const [editTripForm, setEditTripForm] = useState({
        title: '',
        startDate: '',
        endDate: '',
        baseCurrency: 'TWD',
        budget: 0,
        status: 'planning'
    });

    const handleOpenEditTrip = () => {
        if (!activeTrip) return;
        setEditTripForm({
            title: activeTrip.title || '',
            startDate: activeTrip.startDate || '',
            endDate: activeTrip.endDate || '',
            baseCurrency: activeTrip.baseCurrency || 'TWD',
            budget: activeTrip.budget || 0,
            status: activeTrip.status || 'planning'
        });
        setIsEditTripModalOpen(true);
    };

    const handleSaveTrip = async (e) => {
        e.preventDefault();
        if (!activeTrip || !editTripForm.title.trim()) return;
        await updateTrip({
            ...activeTrip,
            title: editTripForm.title.trim(),
            startDate: editTripForm.startDate,
            endDate: editTripForm.endDate,
            baseCurrency: editTripForm.baseCurrency,
            budget: Number(editTripForm.budget) || 0,
            status: editTripForm.status
        });
        setIsEditTripModalOpen(false);
    };

    const handleDeleteCurrentTrip = async () => {
        if (!activeTrip) return;
        if (confirm(`確定要刪除旅程「${activeTrip.title}」及其所有預訂與日程嗎？此操作無法復原。`)) {
            await deleteTrip(activeTrip.id);
        }
    };

    // 傳統外站票與行程配對資料 (供全景時間軸連動)
    const { filteredItinerary, filteredHotels } = useFilterContext();
    const { tickets, tripLabels, setTripLabels } = useTicketDataContext();
    const { rawHotels } = useHotelDataContext();
    const { activities } = useActivityDataContext();
    const { tripOverrides, removeSegment, restoreSegment, moveSegmentToTrip, clearAllOverrides } = useOverrideDataContext();

    // 整合全域機票、飯店、活動與當前旅程預訂
    const unifiedReservations = useMemo(() => {
        return getUnifiedReservations(activeTrip, reservations, tickets, rawHotels, activities);
    }, [activeTrip, reservations, tickets, rawHotels, activities]);

    // 當切換到全景時間軸時，抓取該旅程所有景點呈現於右側地圖
    const loadAllTripPlaces = useCallback(async () => {
        if (!activeTrip) return;
        const allPlaces = await placeItemRepo.getByTrip(activeTrip.id);
        setSelectedPlaces(allPlaces);
        setRouteGeometry(null);
    }, [activeTrip]);

    useEffect(() => {
        if (currentSubTab === 'timeline') {
            loadAllTripPlaces();
        }
    }, [currentSubTab, loadAllTripPlaces]);

    // 點選時間軸上的飯店時，在地圖上高亮該飯店
    const handleSelectHotelForTimeline = (hotelId) => {
        const hotel = (filteredHotels || []).find(h => h.id === hotelId);
        if (hotel && hotel.lat && hotel.lng) {
            setSelectedPlaces([
                {
                    id: hotel.id,
                    name: hotel.name,
                    lat: hotel.lat,
                    lng: hotel.lng,
                    address: hotel.address || hotel.city,
                    isAnchorStart: true
                }
            ]);
        }
    };

    if (!activeTrip) {
        return (
            <div className="p-12 text-center text-slate-500">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-base font-semibold">尚未選擇旅程</p>
                <p className="text-xs text-slate-400 mt-1">請於上方導航列選擇或建立一趟新旅程</p>
            </div>
        );
    }

    const showPlanner = viewMode !== 'map-only';
    const showMap = viewMode !== 'planner-only';

    return (
        <div className="relative">
            {/* 唯讀分享模式專屬橫幅 */}
            {isSharedView && (
                <div className="mb-4 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/10 border border-indigo-200 dark:border-indigo-800/60 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                            <Share2 className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                                    唯讀分享預覽
                                </span>
                                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                    正在檢視分享行程：{activeTrip.title}
                                </h3>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                此為他人分享的行程快照。點擊「匯入至我的旅程」即可複製一份到本地並自由編輯。
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <button
                            onClick={importSharedTripToLocal}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition active:scale-95"
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span>匯入至我的旅程</span>
                        </button>
                        <button
                            onClick={exitSharedView}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold rounded-lg transition active:scale-95"
                        >
                            <X className="w-3.5 h-3.5" />
                            <span>退出預覽</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Mobile View Toggle Bar (僅在手機螢幕顯示) */}
            <div className="lg:hidden flex mb-4 bg-slate-200/80 p-1 rounded-xl text-xs font-bold text-slate-600">
                <button
                    onClick={() => setMobileActiveView('planner')}
                    className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${mobileActiveView === 'planner' ? 'bg-white text-indigo-700 shadow-sm' : ''}`}
                >
                    <ListFilter className="w-3.5 h-3.5" />
                    <span>日程與預訂</span>
                </button>
                <button
                    onClick={() => setMobileActiveView('map')}
                    className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${mobileActiveView === 'map' ? 'bg-white text-indigo-700 shadow-sm' : ''}`}
                >
                    <MapIcon className="w-3.5 h-3.5" />
                    <span>地圖模式</span>
                </button>
            </div>

            {/* Desktop & Tablet Split View Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* ── Left Column: Master Timeline / Planner (佔 7 欄或 12 欄) ── */}
                {showPlanner && (
                    <div className={`space-y-4 min-w-0 w-full ${showMap ? 'lg:col-span-7 xl:col-span-6' : 'lg:col-span-12'} ${mobileActiveView !== 'planner' ? 'hidden lg:block' : 'block'}`}>
                        {/* Trip Summary Card */}
                        <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-950 rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
                            <div className="relative z-10">
                                <div className="flex items-center justify-between gap-3 mb-1">
                                    <h2 className="text-xl font-black tracking-wide truncate">{activeTrip.title}</h2>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <ShareButton variant="header" />
                                        {isSharedView ? (
                                            <button
                                                onClick={importSharedTripToLocal}
                                                className="px-2.5 py-1 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold transition flex items-center gap-1 shadow-xs"
                                                title="複製此分享行程至您的本地旅程庫"
                                            >
                                                <Download className="w-3.5 h-3.5" />
                                                <span className="hidden sm:inline">匯入副本</span>
                                            </button>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={handleOpenEditTrip}
                                                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition flex items-center gap-1 border border-white/20"
                                                    title="編輯旅程名稱、日期與預算"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                    <span className="hidden sm:inline">編輯</span>
                                                </button>
                                                <button
                                                    onClick={() => toggleArchiveTrip(activeTrip.id)}
                                                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition flex items-center gap-1 border border-white/20"
                                                    title={isTripArchivedOrEnded(activeTrip) ? "解除封存（移回規劃中）" : "封存旅程"}
                                                >
                                                    {isTripArchivedOrEnded(activeTrip) ? (
                                                        <>
                                                            <ArchiveRestore className="w-3.5 h-3.5 text-emerald-300" />
                                                            <span className="hidden sm:inline">解除封存</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Archive className="w-3.5 h-3.5 text-amber-300" />
                                                            <span className="hidden sm:inline">封存</span>
                                                        </>
                                                    )}
                                                </button>
                                                <button
                                                    onClick={handleDeleteCurrentTrip}
                                                    className="p-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 text-rose-200 hover:text-white text-xs font-bold transition border border-rose-500/30"
                                                    title="刪除此旅程"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </>
                                        )}
                                        {(() => {
                                            const st = getTripStatus(activeTrip);
                                            if (st === 'ongoing') {
                                                return (
                                                    <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/30 text-emerald-200 font-bold border border-emerald-400/40">
                                                        進行中
                                                    </span>
                                                );
                                            }
                                            if (st === 'completed') {
                                                return (
                                                    <span className="text-xs px-2.5 py-1 rounded-full bg-slate-700/80 text-slate-300 font-bold border border-slate-600">
                                                        已結束
                                                    </span>
                                                );
                                            }
                                            if (st === 'archived') {
                                                return (
                                                    <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/30 text-amber-200 font-bold border border-amber-400/40">
                                                        已封存
                                                    </span>
                                                );
                                            }
                                            return (
                                                <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-500/30 text-indigo-200 font-bold border border-indigo-400/30">
                                                    規劃中
                                                </span>
                                            );
                                        })()}
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-4 text-xs text-indigo-200 font-medium mt-2">
                                    <span className="flex items-center gap-1">
                                        <Calendar className="w-3.5 h-3.5 text-indigo-300" />
                                        {activeTrip.startDate} ~ {activeTrip.endDate}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Ticket className="w-3.5 h-3.5 text-emerald-300" />
                                        {unifiedReservations.length} 個預訂項目
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* SubTab 核心內容區 */}
                        {currentSubTab === 'daily' && (
                            <DayPlanTimeline 
                                onSelectDayPlaces={setSelectedPlaces} 
                                onRouteCalculated={setRouteGeometry} 
                                unifiedReservations={unifiedReservations}
                            />
                        )}

                        {currentSubTab === 'timeline' && (
                            <div className="space-y-4">
                                <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-800 flex items-center justify-between">
                                    <span>💡 全景時間軸已與右側地圖連動，可隨時點擊各趟次與飯店查看詳細時序</span>
                                    <button 
                                        onClick={loadAllTripPlaces}
                                        className="font-bold text-indigo-600 hover:underline shrink-0 ml-2"
                                    >
                                        重置地圖視野
                                    </button>
                                </div>
                                <TripTimeline
                                    trips={filteredItinerary}
                                    tripLabels={tripLabels}
                                    onUpdateLabel={(id, val) => setTripLabels(p => ({ ...p, [id]: val }))}
                                    overrideState={tripOverrides}
                                    onRemoveSegment={removeSegment}
                                    onRestoreSegment={restoreSegment}
                                    onMoveSegmentToTrip={moveSegmentToTrip}
                                    onClearAllOverrides={clearAllOverrides}
                                    onSelectHotelForMap={handleSelectHotelForTimeline}
                                    onSelectTripForMap={() => {}}
                                />
                            </div>
                        )}

                        {currentSubTab === 'reservations' && (
                            <ReservationManager unifiedReservations={unifiedReservations} />
                        )}
                    </div>
                )}

                {/* ── Right Column: Interactive Map Viewport (佔 5 欄或 12 欄) ── */}
                {showMap && (
                    <div className={`sticky top-20 min-w-0 w-full ${showPlanner ? 'lg:col-span-5 xl:col-span-6' : 'lg:col-span-12'} ${mobileActiveView !== 'map' ? 'hidden lg:block' : 'block'}`}>
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-6rem)]">
                            <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-slate-50/70 text-xs font-bold text-slate-700">
                                <span className="flex items-center gap-1.5">
                                    <MapPin className="w-4 h-4 text-indigo-600" />
                                    <span>互動地圖視窗 (向量圖資 & 路線導航)</span>
                                </span>
                                <button
                                    onClick={() => setViewMode(viewMode === 'map-only' ? 'split' : 'map-only')}
                                    className="p-1 rounded hover:bg-slate-200 text-slate-500 transition"
                                    title={viewMode === 'map-only' ? '恢復雙欄' : '全螢幕地圖'}
                                >
                                    {viewMode === 'map-only' ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                                </button>
                            </div>
                            <div className="flex-1 w-full relative min-h-0 h-full">
                                <MapLibreView places={selectedPlaces} routeGeometry={routeGeometry} />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 編輯旅程 Modal */}
            {isEditTripModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-800 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                            <h3 className="font-bold text-base flex items-center gap-2">
                                <Edit2 className="w-4 h-4 text-indigo-600" />
                                <span>編輯旅程資訊</span>
                            </h3>
                            <button 
                                onClick={() => setIsEditTripModalOpen(false)} 
                                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
                            >
                                &times;
                            </button>
                        </div>

                        <form onSubmit={handleSaveTrip} className="space-y-3.5">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">旅程名稱</label>
                                <input
                                    type="text"
                                    value={editTripForm.title}
                                    onChange={(e) => setEditTripForm(p => ({ ...p, title: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">開始日期</label>
                                    <input
                                        type="date"
                                        value={editTripForm.startDate}
                                        onChange={(e) => setEditTripForm(p => ({ ...p, startDate: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">結束日期</label>
                                    <input
                                        type="date"
                                        value={editTripForm.endDate}
                                        onChange={(e) => setEditTripForm(p => ({ ...p, endDate: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">基準幣別</label>
                                    <select
                                        value={editTripForm.baseCurrency}
                                        onChange={(e) => setEditTripForm(p => ({ ...p, baseCurrency: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 bg-white"
                                    >
                                        <option value="TWD">TWD 新台幣</option>
                                        <option value="JPY">JPY 日圓</option>
                                        <option value="USD">USD 美元</option>
                                        <option value="EUR">EUR 歐元</option>
                                        <option value="KRW">KRW 韓圓</option>
                                        <option value="THB">THB 泰銖</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">旅程狀態</label>
                                    <select
                                        value={editTripForm.status}
                                        onChange={(e) => setEditTripForm(p => ({ ...p, status: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 bg-white"
                                    >
                                        <option value="planning">規劃中 (依行程日期自動運作)</option>
                                        <option value="ongoing">進行中 (手動指定)</option>
                                        <option value="completed">已結束 (Completed)</option>
                                        <option value="archived">已封存 (Archived)</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">預算金額</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={editTripForm.budget}
                                    onChange={(e) => setEditTripForm(p => ({ ...p, budget: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setIsEditTripModalOpen(false)}
                                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition"
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-sm transition"
                                >
                                    儲存修改
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
