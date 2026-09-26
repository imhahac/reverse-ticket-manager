/**
 * DayPlanTimeline.jsx
 * 每日日程時間軸排程器：
 * - 顯示每日行程清單 (Day 1, Day 2...)
 * - 整合 Open-Meteo 天氣預報徽章
 * - 支援 2-opt TSP 一鍵路徑最佳化 (鎖定錨點保護)
 * - 支援 OSRM 道路行車線計算與 Google Maps 外部導航
 * - 支援景點搜尋 (OSM Nominatim) 與維基百科圖文富化
 */

import React, { useState, useEffect } from 'react';
import { 
    Calendar, 
    Plus, 
    Sparkles, 
    Lock, 
    Unlock, 
    ArrowUp, 
    ArrowDown, 
    Trash2, 
    MapPin, 
    ExternalLink, 
    Navigation, 
    Search, 
    Loader2, 
    Check, 
    FileText,
    BookOpen,
    Plane,
    Hotel,
    Ticket,
    Tag,
    Building2,
    Edit2
} from 'lucide-react';
import { toast } from 'sonner';
import { useTrek } from '../../contexts/TrekContext';
import { placeItemRepo, dayPlanRepo } from '../../services/db';
import { optimizeRouteWith2Opt, calculateTotalRouteDistance } from '../../services/map/tspService';
import { getOSRMRoute, getGoogleMapsRouteUrl } from '../../services/map/routeService';
import { searchPlaces, enrichPlaceWithWikipedia } from '../../services/places/placeSearchService';
import { getDayWeather } from '../../services/weather/weatherService';
import { logger } from '../../utils/logger';

export default function DayPlanTimeline({ onSelectDayPlaces, onRouteCalculated, unifiedReservations = null }) {
    const { activeTrip, reservations = [], dayPlans, refreshTrips } = useTrek();
    const activeReservations = unifiedReservations || reservations;
    const [selectedDayIndex, setSelectedDayIndex] = useState(0);
    const [dayPlacesMap, setDayPlacesMap] = useState({}); // { [dayIndex]: places[] }
    const [weatherMap, setWeatherMap] = useState({}); // { [dateStr]: weatherObj }
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [routeStats, setRouteStats] = useState(null);

    // 景點修改狀態
    const [editingPlace, setEditingPlace] = useState(null);
    const [editPlaceName, setEditPlaceName] = useState('');
    const [editPlaceAddress, setEditPlaceAddress] = useState('');

    const handleOpenEditPlace = (place) => {
        setEditingPlace(place);
        setEditPlaceName(place.name || '');
        setEditPlaceAddress(place.address || '');
    };

    const handleSaveEditPlace = async (e) => {
        e.preventDefault();
        if (!editingPlace || !editPlaceName.trim()) return;
        const updated = {
            ...editingPlace,
            name: editPlaceName.trim(),
            address: editPlaceAddress.trim()
        };
        await placeItemRepo.save(updated);
        setDayPlacesMap(prev => ({
            ...prev,
            [selectedDayIndex]: (prev[selectedDayIndex] || []).map(p => p.id === updated.id ? updated : p)
        }));
        setEditingPlace(null);
        toast.success(`已更新景點：${updated.name}`);
    };

    // 1. 根據旅程日期生成天數列表 (Day 1...Day N)
    const tripDays = [];
    if (activeTrip && activeTrip.startDate && activeTrip.endDate) {
        const start = new Date(activeTrip.startDate);
        const end = new Date(activeTrip.endDate);
        let curr = new Date(start);
        let idx = 1;
        while (curr <= end) {
            tripDays.push({
                dayIndex: idx,
                date: curr.toISOString().slice(0, 10)
            });
            curr.setDate(curr.getDate() + 1);
            idx++;
        }
    }

    // 2. 載入景點資料
    useEffect(() => {
        if (!activeTrip) return;
        async function loadPlaces() {
            const allPlaces = await placeItemRepo.getByTrip(activeTrip.id);
            const mapping = {};
            tripDays.forEach((_, i) => { mapping[i] = []; });

            allPlaces.forEach(p => {
                const dayIdx = p.dayIndex ?? 0;
                if (!mapping[dayIdx]) mapping[dayIdx] = [];
                mapping[dayIdx].push(p);
            });

            // 依 orderIndex 排序
            Object.keys(mapping).forEach(k => {
                mapping[k].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
            });

            setDayPlacesMap(mapping);
        }
        loadPlaces();
    }, [activeTrip?.id]);

    // 3. 當選中特定天時，將該天景點傳遞給父層地圖視窗
    useEffect(() => {
        const currentPlaces = dayPlacesMap[selectedDayIndex] || [];
        if (onSelectDayPlaces) {
            onSelectDayPlaces(currentPlaces);
        }
    }, [selectedDayIndex, dayPlacesMap, onSelectDayPlaces]);

    // 4. 抓取當前選取日期的天氣預報
    useEffect(() => {
        const dayInfo = tripDays[selectedDayIndex];
        if (!dayInfo) return;
        const currentPlaces = dayPlacesMap[selectedDayIndex] || [];
        const lat = currentPlaces[0]?.lat || 35.6812;
        const lng = currentPlaces[0]?.lng || 139.7671;

        if (!weatherMap[dayInfo.date]) {
            getDayWeather(lat, lng, dayInfo.date).then(w => {
                if (w) setWeatherMap(prev => ({ ...prev, [dayInfo.date]: w }));
            });
        }
    }, [selectedDayIndex, tripDays, dayPlacesMap]);

    const activeDayPlaces = dayPlacesMap[selectedDayIndex] || [];
    const activeDayInfo = tripDays[selectedDayIndex] || { dayIndex: 1, date: activeTrip?.startDate };
    const currentWeather = weatherMap[activeDayInfo.date];

    // ── 整合當日預訂 (機票、飯店、活動) ──────────────────────────
    const dayReservations = React.useMemo(() => {
        if (!activeDayInfo?.date || !activeReservations || activeReservations.length === 0) return [];
        const dateStr = activeDayInfo.date;
        return activeReservations.filter(r => {
            if (r.type === 'flight') {
                const depDate = r.flightDetails?.departureTime?.slice(0, 10) || r.startDate?.slice(0, 10);
                const arrDate = r.flightDetails?.arrivalTime?.slice(0, 10) || r.endDate?.slice(0, 10);
                return depDate === dateStr || arrDate === dateStr;
            }
            if (r.type === 'hotel' || r.type === 'accommodation') {
                const checkIn = r.accommodationDetails?.checkInDate?.slice(0, 10) || r.startDate?.slice(0, 10);
                const checkOut = r.accommodationDetails?.checkOutDate?.slice(0, 10) || r.endDate?.slice(0, 10);
                if (checkIn === dateStr || checkOut === dateStr) return true;
                if (checkIn && checkOut && dateStr > checkIn && dateStr < checkOut) return true;
                return false;
            }
            const eventDate = r.activityDetails?.date?.slice(0, 10) || r.startDate?.slice(0, 10);
            return eventDate === dateStr;
        });
    }, [activeDayInfo?.date, activeReservations]);

    // ── 景點操作 ──────────────────────────────────────────────────────────

    const handleToggleLock = async (place) => {
        const updated = { ...place, isLocked: !place.isLocked };
        await placeItemRepo.save(updated);
        setDayPlacesMap(prev => ({
            ...prev,
            [selectedDayIndex]: prev[selectedDayIndex].map(p => p.id === place.id ? updated : p)
        }));
    };

    const handleMoveOrder = async (index, direction) => {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= activeDayPlaces.length) return;

        const updated = [...activeDayPlaces];
        const [moved] = updated.splice(index, 1);
        updated.splice(targetIndex, 0, moved);

        // 重排 orderIndex
        updated.forEach((p, idx) => { p.orderIndex = idx; });
        await placeItemRepo.saveBatch(updated);

        setDayPlacesMap(prev => ({
            ...prev,
            [selectedDayIndex]: updated
        }));
    };

    const handleDeletePlace = async (id) => {
        await placeItemRepo.delete(id);
        setDayPlacesMap(prev => ({
            ...prev,
            [selectedDayIndex]: prev[selectedDayIndex].filter(p => p.id !== id)
        }));
        toast.info('景點已移除');
    };

    // ── 智慧 2-opt TSP 排程最佳化 ──────────────────────────────────────────

    const handleOptimizeTSP = async () => {
        if (activeDayPlaces.length < 3) {
            toast.info('至少需要 3 個景點才能進行路徑最佳化');
            return;
        }

        setIsOptimizing(true);
        try {
            const { optimizedPlaces, improvedKm } = optimizeRouteWith2Opt(activeDayPlaces);
            optimizedPlaces.forEach((p, idx) => { p.orderIndex = idx; });
            await placeItemRepo.saveBatch(optimizedPlaces);

            setDayPlacesMap(prev => ({
                ...prev,
                [selectedDayIndex]: optimizedPlaces
            }));

            if (improvedKm > 0) {
                toast.success(`✨ 最佳化完成！預估減少 ${improvedKm} km 繞路距離`);
            } else {
                toast.success('當前順序已是最優路徑！');
            }

            // 自動觸發 OSRM 繪製路線
            handleCalculateOSRM(optimizedPlaces);
        } catch (err) {
            logger.error('TSP optimization error:', err);
        } finally {
            setIsOptimizing(false);
        }
    };

    // ── OSRM 實際道路計算 ──────────────────────────────────────────────────

    const handleCalculateOSRM = async (placesToRoute = activeDayPlaces) => {
        if (placesToRoute.length < 2) return;
        const coords = placesToRoute.map(p => ({ lat: p.lat, lng: p.lng }));
        const osrmResult = await getOSRMRoute(coords, 'driving');

        if (osrmResult) {
            setRouteStats({
                distanceKm: osrmResult.distanceKm,
                durationMinutes: osrmResult.durationMinutes
            });
            if (onRouteCalculated) {
                onRouteCalculated(osrmResult.geometry);
            }
        }
    };

    // ── 地點搜尋與加入 ──────────────────────────────────────────────────────

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        const results = await searchPlaces(searchQuery);
        setSearchResults(results);
        setIsSearching(false);
    };

    const handleAddPlace = async (result) => {
        // 富化維基百科介紹
        const enrichment = await enrichPlaceWithWikipedia(result.name);

        const newPlace = {
            id: `place_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            tripId: activeTrip.id,
            dayIndex: selectedDayIndex,
            name: result.name,
            lat: result.lat,
            lng: result.lng,
            address: result.address,
            orderIndex: activeDayPlaces.length,
            isLocked: false,
            enrichment: enrichment || null,
            createdAt: Date.now()
        };

        await placeItemRepo.save(newPlace);
        setDayPlacesMap(prev => ({
            ...prev,
            [selectedDayIndex]: [...(prev[selectedDayIndex] || []), newPlace]
        }));

        toast.success(`已加入景點：${newPlace.name}`);
        setIsAddModalOpen(false);
        setSearchQuery('');
        setSearchResults([]);
    };

    return (
        <div className="space-y-4">
            {/* 1. 每日標籤橫向滑動列 (Day 1, Day 2...) */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                {tripDays.map((day, idx) => (
                    <button
                        key={day.date}
                        onClick={() => { setSelectedDayIndex(idx); setRouteStats(null); }}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                            selectedDayIndex === idx
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                                : 'bg-white text-slate-600 hover:bg-slate-100 border border-gray-200'
                        }`}
                    >
                        <span>Day {day.dayIndex}</span>
                        <span className="text-[10px] opacity-70">({day.date.slice(5)})</span>
                    </button>
                ))}
            </div>

            {/* 2. 當日頂部卡片：日期與天氣預報 */}
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                        <span>Day {activeDayInfo.dayIndex} 行程</span>
                        <span className="text-xs font-normal text-slate-400">({activeDayInfo.date})</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                        共 {activeDayPlaces.length} 個行程停靠點
                        {routeStats && (
                            <span className="ml-2 font-bold text-indigo-600">
                                · 🚗 全程約 {routeStats.distanceKm} km (車程約 {routeStats.durationMinutes} 分鐘)
                            </span>
                        )}
                    </p>
                </div>

                {/* 天氣預報 Badge */}
                {currentWeather ? (
                    <div className="flex items-center gap-2 bg-sky-50 border border-sky-100 px-3 py-1.5 rounded-xl text-sky-800">
                        <span className="text-xl">{currentWeather.icon}</span>
                        <div>
                            <div className="text-xs font-bold leading-tight">{currentWeather.desc}</div>
                            <div className="text-[10px] text-sky-600">
                                {currentWeather.tempMin}°C ~ {currentWeather.tempMax}°C · 降雨 {currentWeather.rainProb}%
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-xs text-slate-400">載入天氣中...</div>
                )}
            </div>

            {/* 2.5 當日交通、住宿與活動整合時序卡片 */}
            {dayReservations.length > 0 ? (
                <div className="bg-slate-900 text-white rounded-xl p-3.5 shadow-sm space-y-2.5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                            <Plane className="w-3.5 h-3.5 text-indigo-400" />
                            <span>當日交通與住宿排程 ({dayReservations.length})</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">已自動整合至時間表</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {dayReservations.map(res => {
                            const isFlight = res.type === 'flight';
                            const isHotel = res.type === 'hotel' || res.type === 'accommodation';
                            const checkIn = res.accommodationDetails?.checkInDate?.slice(0, 10);
                            const checkOut = res.accommodationDetails?.checkOutDate?.slice(0, 10);
                            const isCheckInDay = checkIn === activeDayInfo.date;
                            const isCheckOutDay = checkOut === activeDayInfo.date;

                            return (
                                <div 
                                    key={res.id} 
                                    className="bg-slate-800/90 border border-slate-700/80 rounded-lg p-2.5 flex items-start gap-2.5 hover:bg-slate-800 transition"
                                >
                                    <div className="p-1.5 rounded-md bg-indigo-500/20 text-indigo-300 shrink-0 mt-0.5">
                                        {isFlight ? <Plane className="w-4 h-4" /> : isHotel ? <Hotel className="w-4 h-4" /> : <Ticket className="w-4 h-4" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-1">
                                            <span className="text-xs font-bold text-white truncate">
                                                {isFlight 
                                                    ? `${res.flightDetails?.airline || ''} ${res.flightDetails?.flightNumber || res.title}`
                                                    : isHotel 
                                                        ? (res.accommodationDetails?.hotelName || res.title)
                                                        : res.title
                                                }
                                            </span>
                                            {isHotel && (
                                                <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold shrink-0 ${
                                                    isCheckInDay ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                                                    isCheckOutDay ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                                                    'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                                }`}>
                                                    {isCheckInDay ? '辦理入住' : isCheckOutDay ? '辦理退房' : '住宿中'}
                                                </span>
                                            )}
                                            {isFlight && res.confirmationCode && (
                                                <span className="text-[10px] font-mono bg-indigo-500/30 text-indigo-200 px-1 rounded shrink-0">
                                                    {res.confirmationCode}
                                                </span>
                                            )}
                                        </div>

                                        {isFlight && (
                                            <div className="text-[11px] text-slate-300 mt-1 flex items-center gap-1.5">
                                                <span className="font-semibold text-indigo-300">
                                                    {res.flightDetails?.from || '出發站'} ➔ {res.flightDetails?.to || '抵達站'}
                                                </span>
                                                {(res.flightDetails?.departureTime || res.flightDetails?.arrivalTime) && (
                                                    <span className="text-slate-400 text-[10px]">
                                                        {res.flightDetails?.departureTime ? res.flightDetails.departureTime.slice(11, 16) : ''}
                                                        {res.flightDetails?.arrivalTime ? ` ~ ${res.flightDetails.arrivalTime.slice(11, 16)}` : ''}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {isHotel && (
                                            <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                                                {res.accommodationDetails?.address || res.notes || '已確認預約'}
                                            </div>
                                        )}

                                        {!isFlight && !isHotel && (
                                            <div className="text-[11px] text-slate-400 mt-0.5">
                                                {res.activityDetails?.location || res.notes || '票券憑證'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : null}

            {/* 3. 工具列：智慧最佳化、路線計算、開啟外部 Google Maps */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleOptimizeTSP}
                        disabled={isOptimizing || activeDayPlaces.length < 3}
                        className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                        title="透過 2-opt 演算法重排未鎖定之景點，最小化繞路距離"
                    >
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>智慧最佳化 (2-opt)</span>
                    </button>

                    <button
                        onClick={() => handleCalculateOSRM()}
                        disabled={activeDayPlaces.length < 2}
                        className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-gray-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                        <Navigation className="w-3.5 h-3.5 text-indigo-600" />
                        <span>繪製導航路線</span>
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    {activeDayPlaces.length > 0 && (
                        <a
                            href={getGoogleMapsRouteUrl(activeDayPlaces)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>在 Google Maps 開啟</span>
                        </a>
                    )}

                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center gap-1"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>加入景點</span>
                    </button>
                </div>
            </div>

            {/* 4. 景點列表 (依 orderIndex 排序) */}
            <div className="space-y-2.5">
                {activeDayPlaces.length === 0 ? (
                    <div className="bg-white rounded-xl p-8 text-center text-slate-400 border border-gray-200 border-dashed">
                        <MapPin className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                        <p className="text-sm font-semibold">這一天尚未安排任何景點</p>
                        <p className="text-xs text-slate-400 mt-1">點擊上方「加入景點」以搜尋並排入行程</p>
                    </div>
                ) : (
                    activeDayPlaces.map((place, idx) => (
                        <div
                            key={place.id}
                            className={`bg-white rounded-xl p-3.5 border transition-all shadow-sm flex items-start justify-between gap-3 ${
                                place.isLocked ? 'border-amber-200 bg-amber-50/20' : 'border-gray-200'
                            }`}
                        >
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                                {/* 景點序號 */}
                                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-black shrink-0 mt-0.5">
                                    {idx + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-sm text-slate-800 truncate">{place.name}</span>
                                        {place.isLocked && (
                                            <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded flex items-center gap-0.5">
                                                <Lock className="w-2.5 h-2.5" /> 鎖定
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-400 truncate mt-0.5">{place.address}</p>

                                    {/* 維基百科富化簡介 */}
                                    {place.enrichment?.description && (
                                        <div className="mt-2 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-start gap-2">
                                            {place.enrichment.thumbnailUrl && (
                                                <img 
                                                    src={place.enrichment.thumbnailUrl} 
                                                    alt={place.name}
                                                    className="w-12 h-12 object-cover rounded shrink-0" 
                                                />
                                            )}
                                            <p className="line-clamp-2 leading-relaxed text-[11px] text-slate-500">
                                                {place.enrichment.description}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 景點右側操作按鈕 */}
                            <div className="flex items-center gap-1 shrink-0">
                                <button
                                    onClick={() => handleToggleLock(place)}
                                    title={place.isLocked ? '解鎖排序' : '鎖定此位置 (最佳化時不調動)'}
                                    className={`p-1.5 rounded-lg border transition ${
                                        place.isLocked ? 'bg-amber-100 text-amber-700 border-amber-300' : 'text-slate-400 hover:bg-slate-100 border-gray-200'
                                    }`}
                                >
                                    {place.isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                    onClick={() => handleMoveOrder(idx, -1)}
                                    disabled={idx === 0}
                                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 border border-gray-200 rounded-lg disabled:opacity-30"
                                >
                                    <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => handleMoveOrder(idx, 1)}
                                    disabled={idx === activeDayPlaces.length - 1}
                                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 border border-gray-200 rounded-lg disabled:opacity-30"
                                >
                                    <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => handleOpenEditPlace(place)}
                                    title="修改景點資訊"
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-gray-200 rounded-lg transition"
                                >
                                    <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => handleDeletePlace(place.id)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 border border-gray-200 rounded-lg"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* 5. 新增景點 Modal (Nominatim 搜尋 + 即時維基圖文) */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl text-slate-800 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-base flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-indigo-600" /> 加入景點至 Day {activeDayInfo.dayIndex}
                            </h3>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
                        </div>

                        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
                            <input
                                type="text"
                                placeholder="輸入景點、餐廳或地名 (例如: 東京鐵塔, 淺草寺)"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                                autoFocus
                            />
                            <button
                                type="submit"
                                disabled={isSearching}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-500 transition flex items-center gap-1"
                            >
                                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                <span>搜尋</span>
                            </button>
                        </form>

                        <div className="max-h-72 overflow-y-auto space-y-2">
                            {searchResults.length === 0 && !isSearching && (
                                <p className="text-xs text-slate-400 text-center py-6">請輸入關鍵字搜尋 OpenStreetMap 開放圖資</p>
                            )}
                            {searchResults.map((res) => (
                                <div
                                    key={res.id}
                                    onClick={() => handleAddPlace(res)}
                                    className="p-3 rounded-xl border border-gray-200 hover:border-indigo-500 hover:bg-indigo-50/30 cursor-pointer transition flex items-center justify-between gap-3"
                                >
                                    <div className="truncate">
                                        <div className="font-bold text-sm text-slate-800">{res.name}</div>
                                        <div className="text-xs text-slate-400 truncate">{res.address}</div>
                                    </div>
                                    <button className="px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded-lg shrink-0">
                                        加入
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 6. 修改景點 Modal */}
            {editingPlace && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-800 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                            <h3 className="font-bold text-base flex items-center gap-2">
                                <Edit2 className="w-4 h-4 text-indigo-600" />
                                <span>修改景點資訊</span>
                            </h3>
                            <button
                                onClick={() => setEditingPlace(null)}
                                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
                            >
                                &times;
                            </button>
                        </div>
                        <form onSubmit={handleSaveEditPlace} className="space-y-3.5">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">景點名稱</label>
                                <input
                                    type="text"
                                    required
                                    value={editPlaceName}
                                    onChange={(e) => setEditPlaceName(e.target.value)}
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">地址 / 備註資訊</label>
                                <textarea
                                    rows="2"
                                    value={editPlaceAddress}
                                    onChange={(e) => setEditPlaceAddress(e.target.value)}
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setEditingPlace(null)}
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
