/**
 * TripTimeline.jsx ── 實際飛行配對 Timeline 元件
 *
 * 修正項目：
 *  1. [BUG FIX] useState 呼叫位置違反 React Hooks 規則
 *     → showFuture / showPast 移至元件最頂層（early return 之前）
 *  2. [重構] 抽取 TripCard 元件，消除未來/歷史區塊約 300 行完全重複的程式碼
 *  3. [細節] 防呆：seg.ticket?.airline 改用可選鏈，避免孤兒段 crash
 */
import React, { useMemo, useState } from 'react';
import {
    AlertTriangle, ArrowRight, Edit3, Check, X,
    PlaneTakeoff, PlaneLanding, Clock, CheckCircle2, Plane,
} from 'lucide-react';
import { formatDateWithDay } from '../utils/dateHelpers';
import HotelStayCard from '../features/hotels/components/HotelStayCard';

// ─────────────────────────────────────────────────────────────────────────────
// TripCard：單一趟次卡片（純展示，狀態由父元件管理）
// ─────────────────────────────────────────────────────────────────────────────
function TripCard({
    trip,
    index,
    tripLabels,
    tripIdOptions,
    onRemoveSegment,
    onMoveSegmentToTrip,
    // 標籤編輯（父元件共用同一個編輯狀態）
    editingLabelId,
    editLabelValue,
    setEditLabelValue,
    onStartEditing,
    onSaveLabel,
    onCancelEditing,
    // 拖曳（父元件共用）
    onSelectTripForMap, // 新增：在地圖上查看單一行程
    dragOverTripId,
    setDragOverTripId,
    onSegDragStart,
    onTripDragOver,
    onTripDrop,
    // 輔助函式
    getDepartDate,
    getArrivalDate,
    formatDuration,
}) {
    const comboKey = trip.id;

    // 優先使用 decoratedTrips 算好的 segments，若無則從舊欄位組裝
    const segments = Array.isArray(trip.segments) && trip.segments.length > 0
        ? trip.segments
        : (() => {
            const segs = [];
            if (trip.outbound) segs.push(trip.outbound);
            segs.push(...(trip.connections || []));
            if (trip.inbound)  segs.push(trip.inbound);
            return segs;
        })();

    const totalCostTWD    = trip.totalCostTWD     ?? 0;
    const totalHotelCostTWD = trip.totalHotelCostTWD ?? 0;
    const grandTotalTWD   = totalCostTWD + totalHotelCostTWD;
    const isOpenJaw       = trip.isOpenJaw         ?? false;
    const tripDays        = trip.tripDays           ?? null;
    const isExternalOnly  = trip.isExternalOnly;
    const customLabel     = tripLabels[comboKey] || `Trip ${index + 1}`;
    const matchedHotels   = trip.matchedHotels      ?? [];
    const hotelWarns      = trip.hotelWarnings       || [];

    // ── 外觀 ──────────────────────────────────────────────────────────────
    const borderColor =
        isExternalOnly     ? 'border-blue-300'    :
        !trip.isComplete   ? 'border-amber-300'   :
        isOpenJaw          ? 'border-yellow-300'  : 'border-emerald-300';

    const badgeBg =
        isExternalOnly     ? 'bg-blue-500'    :
        !trip.isComplete   ? 'bg-amber-500'   :
        isOpenJaw          ? 'bg-yellow-500'  : 'bg-emerald-500';

    const badgeLabel =
        isExternalOnly     ? '外站獨立行程' :
        !trip.isComplete   ? '未完結行程'   :
        isOpenJaw          ? '不同點進出'   : '配對成功';

    const BadgeIcon = (isExternalOnly || (trip.isComplete && !isOpenJaw))
        ? <CheckCircle2 className="w-3 h-3 mr-1" />
        : <AlertTriangle className="w-3 h-3 mr-1" />;

    return (
        <div
            onDragOver={e => onTripDragOver(e, comboKey)}
            onDragLeave={() => setDragOverTripId(null)}
            onDrop={e => onTripDrop(e, comboKey)}
            className={`relative flex flex-col md:flex-row items-stretch bg-white border
                ${borderColor}
                ${dragOverTripId === comboKey ? 'ring-2 ring-indigo-400' : ''}
                rounded-xl shadow-sm hover:shadow-md transition-shadow mt-4`}
        >
            {/* ── 狀態徽章 ───────────────────────────────────────────────── */}
            <div className={`absolute -top-3 -right-2 px-3 py-1 text-xs font-bold text-white
                rounded-full shadow-sm flex items-center z-20 ${badgeBg}`}>
                {BadgeIcon}
                {badgeLabel}
                {tripDays && (
                    <span className="ml-2 pl-2 border-l border-white/30">共 {tripDays} 天</span>
                )}
            </div>

            {/* ── 左側成本面板 ───────────────────────────────────────────── */}
            <div className="bg-slate-50 border-r border-slate-200 p-5 flex flex-col justify-center
                items-center rounded-l-xl w-full md:w-56 shrink-0 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl
                    from-slate-200/50 to-transparent rounded-bl-full pointer-events-none" />

                {/* 標籤編輯 */}
                {editingLabelId === comboKey ? (
                    <div className="flex flex-col gap-2 w-full mt-2 relative z-10">
                        <input
                            autoFocus
                            type="text"
                            className="w-full text-sm p-1.5 border border-indigo-300 rounded
                                focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            value={editLabelValue}
                            onChange={e => setEditLabelValue(e.target.value)}
                            placeholder="自訂行程名稱..."
                            onKeyDown={e => e.key === 'Enter' && onSaveLabel(comboKey)}
                        />
                        <div className="flex justify-end gap-1">
                            <button
                                onClick={() => onSaveLabel(comboKey)}
                                className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                            >
                                <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={onCancelEditing}
                                className="p-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                ) : (
                    <div
                        className="group flex items-center gap-1.5 text-slate-800 font-black
                            text-xl mb-3 text-center relative cursor-pointer z-10"
                        onClick={() => onStartEditing(comboKey, tripLabels[comboKey])}
                    >
                        <span>{customLabel}</span>
                        <Edit3 className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                    </div>
                )}

                <div className="text-2xl font-black text-slate-900 mb-1 tracking-tight">
                    NT$ {Math.round(grandTotalTWD).toLocaleString()}
                </div>

                {totalHotelCostTWD > 0 && (
                    <div className="text-[10px] text-slate-500 mb-1 text-center">
                        機票 {Math.round(totalCostTWD).toLocaleString()} + 住宿 {Math.round(totalHotelCostTWD).toLocaleString()}
                    </div>
                )}

                {tripDays && tripDays > 0 && (
                    <div className="text-[10px] font-bold text-indigo-900 bg-indigo-100/80
                        px-2 py-1.5 rounded-md border border-indigo-200 mt-2
                        flex flex-col items-center gap-0.5 shadow-sm">
                        <span className="text-[8px] uppercase tracking-tighter opacity-60">
                            每日平均成本 (CP 值)
                        </span>
                        <span>NT$ {Math.round(grandTotalTWD / tripDays).toLocaleString()} / 天</span>
                    </div>
                )}

                <div className="text-xs font-bold text-slate-400 bg-slate-200/50
                    px-2 py-1.5 rounded-md mt-1 border border-slate-200/50">
                    🛫 共 {segments.length} 段航班
                </div>
            </div>

            {/* ── 右側航段列表 ───────────────────────────────────────────── */}
            <div className="flex-1 p-5 lg:p-6 flex flex-col justify-center gap-3 bg-white rounded-r-xl">
                {/* 住宿警告 */}
                {hotelWarns.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-1 space-y-1">
                        {hotelWarns.map((w, i) => (
                            <div key={i} className="text-xs font-bold text-amber-700">{w}</div>
                        ))}
                    </div>
                )}

                {/* 航段列 */}
                {segments.map((seg, i) => {
                    const arrival    = getArrivalDate(seg);
                    const nextDepart = i < segments.length - 1
                        ? getDepartDate(segments[i + 1]) : null;
                    const layoverMs  = arrival && nextDepart ? nextDepart - arrival : null;
                    const layoverText = (layoverMs !== null && layoverMs >= 0)
                        ? formatDuration(layoverMs) : null;
                    const layoverCode = (seg?.to || '').split(' ')[0] || '';

                    return (
                        <React.Fragment key={seg.id || i}>
                            {/* 航段卡片 */}
                            <div
                                draggable
                                onDragStart={e => onSegDragStart(e, seg.id)}
                                className="group flex flex-col sm:flex-row sm:items-center
                                    justify-between gap-3 p-4 bg-slate-50/80 rounded-xl
                                    hover:bg-indigo-50/50 hover:border-indigo-100 transition-all
                                    border border-slate-100 shadow-sm hover:shadow
                                    cursor-grab active:cursor-grabbing"
                                title="可拖曳到其他趟次"
                            >
                                <div className="flex items-center gap-4">
                                    {/* 方向圖示 */}
                                    <div className="w-10 h-10 rounded-full bg-slate-200
                                        group-hover:bg-indigo-100 transition-colors flex items-center
                                        justify-center shrink-0 border border-slate-300
                                        group-hover:border-indigo-200 shadow-inner">
                                        {i === 0 ? (
                                            <PlaneTakeoff className="w-5 h-5 text-slate-600 group-hover:text-indigo-600" />
                                        ) : i === segments.length - 1 ? (
                                            <PlaneLanding className="w-5 h-5 text-slate-600 group-hover:text-indigo-600" />
                                        ) : (
                                            <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-indigo-600" />
                                        )}
                                    </div>

                                    {/* 航班資訊 */}
                                    <div>
                                        <div className="text-xs font-bold text-indigo-500 mb-1
                                            tracking-wide flex items-center gap-2 flex-wrap">
                                            <span>{seg.ticket?.airline || '未知航空公司'}</span>
                                            {seg.flightNo && (
                                                <a
                                                    href={`https://flightaware.com/live/flight/${seg.flightNo}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center text-[10px]
                                                        bg-indigo-50 hover:bg-indigo-100 text-indigo-700
                                                        font-mono px-1.5 py-0.5 rounded border
                                                        border-indigo-200 transition-colors shadow-sm"
                                                    title="前往 FlightAware 觀看航班動態"
                                                    onClick={e => e.stopPropagation()}
                                                >
                                                    {seg.flightNo} ↗
                                                </a>
                                            )}
                                        </div>
                                        <div className="text-base font-bold text-slate-700
                                            flex items-center flex-wrap gap-2">
                                            {seg.from}
                                            <ArrowRight className="w-3 h-3 text-slate-400" />
                                            {seg.to}
                                        </div>

                                        {/* 操作列：移除 / 移到 */}
                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                            <button
                                                type="button"
                                                className="text-[11px] font-bold px-2 py-1 rounded
                                                    border border-slate-200 bg-white hover:bg-slate-50
                                                    text-slate-600"
                                                onClick={() => onRemoveSegment?.(seg.id)}
                                                title="從趟次中移除這段航班"
                                            >
                                                從趟次移除
                                            </button>
                                            <label className="text-[11px] font-bold text-slate-500">
                                                <button
                                                    type="button"
                                                    onClick={() => onSelectTripForMap?.(comboKey)}
                                                    className="px-2 py-1 rounded border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700"
                                                >
                                                    在地圖上查看
                                                </button>
                                                移到
                                                <select
                                                    className="ml-2 text-[11px] font-bold px-2 py-1
                                                        rounded border border-slate-200 bg-white text-slate-700"
                                                    value={comboKey}
                                                    onChange={e => onMoveSegmentToTrip?.(seg.id, e.target.value)}
                                                >
                                                    {tripIdOptions.map(id => (
                                                        <option key={id} value={id}>{id}</option>
                                                    ))}
                                                </select>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                {/* 日期/時間 + 成本 */}
                                <div className="flex flex-col sm:items-end gap-1.5
                                    pt-3 sm:pt-0 border-t border-dashed sm:border-0 border-slate-200">
                                    <div className="text-sm font-extrabold text-slate-700 bg-white
                                        px-3 py-2 rounded-lg shadow-sm border border-slate-200
                                        flex items-center mb-1 ring-1 ring-slate-100">
                                        <span>{formatDateWithDay(seg.date)}</span>
                                        {seg.time && (
                                            <span className="ml-3 pl-3 border-l-2 border-slate-100
                                                text-indigo-600 flex items-center text-base">
                                                <Clock className="w-4 h-4 mr-1.5 text-indigo-400" />
                                                {seg.time}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-[11px] text-slate-400 font-medium
                                        px-1 uppercase tracking-wider">
                                        系統單段成本: NT$ {Math.round(
                                            seg.ticket?.type === 'oneway'
                                                ? (seg.ticket?.priceTWD ?? 0)
                                                : (seg.ticket?.priceTWD ?? 0) / 2
                                        ).toLocaleString()}
                                    </div>
                                </div>
                            </div>

                            {/* 轉機停留時間 */}
                            {layoverText && (
                                <div className="flex items-center justify-center gap-2 py-1.5 px-4
                                    -mt-1 bg-amber-50 border border-dashed border-amber-300
                                    rounded-xl text-amber-700 text-[12px] font-bold">
                                    <Plane className="w-3.5 h-3.5 rotate-90 shrink-0" />
                                    {layoverCode || '転機'} 轉機 {layoverText}
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}

                {/* ── 住宿卡片區 ─────────────────────────────────────────── */}
                {matchedHotels.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-teal-100 space-y-2">
                        <div className="text-xs font-bold text-teal-600 uppercase
                            tracking-wider mb-1 flex items-center gap-1">
                            🏨 住宿安排
                        </div>
                        {matchedHotels.map(h => (
                            <HotelStayCard key={h.id} hotel={h} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// TripTimeline（主元件）
// ─────────────────────────────────────────────────────────────────────────────
export default function TripTimeline({
    trips,
    tripLabels,
    onUpdateLabel,
    overrideState,
    onRemoveSegment,
    onRestoreSegment,
    onMoveSegmentToTrip,
    onSelectTripForMap, // 接收 onSelectTripForMap
    onClearAllOverrides,
}) {
    // ── 所有 useState 必須在 early return 之前宣告（React Hooks 規則） ──
    const [editingLabelId, setEditingLabelId] = useState(null);
    const [editLabelValue, setEditLabelValue] = useState('');
    const [dragOverTripId, setDragOverTripId] = useState(null);
    const [showFuture, setShowFuture]         = useState(true);   // ← 已移至頂層
    const [showPast,   setShowPast]           = useState(true);   // ← 已移至頂層

    // ── 衍生資料 ──────────────────────────────────────────────────────────
    const tripIdOptions = useMemo(() => (trips || []).map(t => t.id), [trips]);

    const hasOverrides = Boolean(
        Object.keys(overrideState?.segTripId || {}).length ||
        (overrideState?.removedSegIds || []).length
    );

    const futureTrips = (trips || []).filter(t => !t.isPast);
    const pastTrips   = (trips || []).filter(t =>  t.isPast);

    // ── 拖曳 ──────────────────────────────────────────────────────────────
    const handleSegDragStart = (e, segId) => {
        try {
            e.dataTransfer.setData('text/plain', segId);
            e.dataTransfer.effectAllowed = 'move';
        } catch { /* ignore */ }
    };

    const handleTripDragOver = (e, tripId) => {
        e.preventDefault();
        setDragOverTripId(tripId);
        try { e.dataTransfer.dropEffect = 'move'; } catch { /* ignore */ }
    };

    const handleTripDrop = (e, tripId) => {
        e.preventDefault();
        setDragOverTripId(null);
        const segId = e.dataTransfer.getData('text/plain');
        if (segId) onMoveSegmentToTrip?.(segId, tripId);
    };

    // ── 輔助函式 ──────────────────────────────────────────────────────────
    const getDepartDate = (seg) => {
        if (!seg?.date || !seg?.time) return null;
        const d = new Date(`${seg.date}T${seg.time}:00`);
        return isNaN(d.getTime()) ? null : d;
    };

    const getArrivalDate = (seg) => {
        if (seg?.arrivalDate && seg?.arrivalTime) {
            const d = new Date(`${seg.arrivalDate}T${seg.arrivalTime}:00`);
            if (!isNaN(d.getTime())) return d;
        }
        const depart = getDepartDate(seg);
        return depart ? new Date(depart.getTime() + 2 * 60 * 60 * 1000) : null;
    };

    const formatDuration = (ms) => {
        const totalMin = Math.round(ms / 60000);
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        if (h <= 0) return `${m} 分`;
        if (m === 0) return `${h} 小時`;
        return `${h} 小時 ${m} 分`;
    };

    // ── 標籤編輯 ──────────────────────────────────────────────────────────
    const handleStartEditing = (tripId, currentLabel) => {
        setEditingLabelId(tripId);
        setEditLabelValue(currentLabel || '');
    };

    const handleSaveLabel = (tripId) => {
        onUpdateLabel(tripId, editLabelValue);
        setEditingLabelId(null);
    };

    const handleCancelEditing = () => {
        setEditingLabelId(null);
        setEditLabelValue('');
    };

    // ── 共用 props（傳給每個 TripCard） ───────────────────────────────────
    const sharedCardProps = {
        tripLabels,
        tripIdOptions,
        onRemoveSegment,
        onMoveSegmentToTrip,
        editingLabelId,
        editLabelValue,
        setEditLabelValue,
        onStartEditing:   handleStartEditing,
        onSaveLabel:      handleSaveLabel,
        onCancelEditing:  handleCancelEditing,
        dragOverTripId,
        setDragOverTripId,
        onSegDragStart:   handleSegDragStart,
        onTripDragOver:   handleTripDragOver,
        onTripDrop:       handleTripDrop,
        onSelectTripForMap, // 傳遞給 TripCard
        getDepartDate,
        getArrivalDate,
        formatDuration,
    };

    // ── 空狀態（Hooks 已全部宣告，此時才可以 early return） ──────────────
    if (!trips || trips.length === 0) {
        return (
            <div className="p-12 text-center text-gray-400 border-2 border-dashed
                border-gray-200 rounded-xl bg-gray-50/50">
                尚無完整的配對行程
            </div>
        );
    }

    // ── 渲染 ──────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6">
            {/* 清除手動重組按鈕 */}
            {hasOverrides && (
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={onClearAllOverrides}
                        className="text-xs font-bold px-3 py-2 rounded-lg border
                            border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                        title="清除所有手動重組/移除的設定"
                    >
                        清除手動重組
                    </button>
                </div>
            )}

            {/* ── 未來行程區塊 ─────────────────────────────────────────── */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-slate-600">
                        未來行程 ({futureTrips.length})
                    </h3>
                    <button
                        type="button"
                        onClick={() => setShowFuture(v => !v)}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                    >
                        {showFuture ? '收合' : '展開'}
                    </button>
                </div>
                {showFuture && futureTrips.map((trip, index) => (
                    <TripCard
                        key={trip.id}
                        trip={trip}
                        index={index}
                        {...sharedCardProps}
                    />
                ))}
            </div>

            {/* ── 歷史行程區塊 ─────────────────────────────────────────── */}
            <div>
                <div className="flex items-center justify-between mb-2 mt-4">
                    <h3 className="text-sm font-bold text-slate-600">
                        歷史行程 ({pastTrips.length})
                    </h3>
                    <button
                        type="button"
                        onClick={() => setShowPast(v => !v)}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                    >
                        {showPast ? '收合' : '展開'}
                    </button>
                </div>
                {showPast && pastTrips.map((trip, index) => (
                    <TripCard
                        key={trip.id}
                        trip={trip}
                        index={index}
                        {...sharedCardProps}
                    />
                ))}
            </div>
        </div>
    );
}
