import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Edit3, Check, X, PlaneTakeoff, PlaneLanding, Clock, CheckCircle2, Plane } from 'lucide-react';
import { formatDateWithDay } from '../utils/dateHelpers';
import HotelStayCard from '../features/hotels/components/HotelStayCard';

export default function TripTimeline({
    trips,
    tripLabels,
    onUpdateLabel,
    overrideState,
    onRemoveSegment,
    onRestoreSegment,
    onMoveSegmentToTrip,
    onClearAllOverrides,
}) {
    const [editingLabelId, setEditingLabelId] = useState(null);
    const [editLabelValue, setEditLabelValue] = useState("");
    const [dragOverTripId, setDragOverTripId] = useState(null);

    const tripIdOptions = useMemo(() => trips.map(t => t.id), [trips]);
    const hasOverrides = Boolean(
        Object.keys(overrideState?.segTripId || {}).length ||
        (overrideState?.removedSegIds || []).length
    );

    const handleSegDragStart = (e, segId) => {
        try {
            e.dataTransfer.setData('text/plain', segId);
            e.dataTransfer.effectAllowed = 'move';
        } catch {
            // ignore
        }
    };

    const handleTripDragOver = (e, tripId) => {
        e.preventDefault();
        setDragOverTripId(tripId);
        try {
            e.dataTransfer.dropEffect = 'move';
        } catch {
            // ignore
        }
    };

    const handleTripDrop = (e, tripId) => {
        e.preventDefault();
        setDragOverTripId(null);
        const segId = e.dataTransfer.getData('text/plain');
        if (segId) onMoveSegmentToTrip?.(segId, tripId);
    };

    const getDepartDate = (seg) => {
        if (!seg?.date || !seg?.time) return null;
        const d = new Date(`${seg.date}T${seg.time}:00`);
        return isNaN(d.getTime()) ? null : d;
    };

    const getArrivalDate = (seg) => {
        if (seg?.arrivalDate && seg?.arrivalTime) {
            const d = new Date(`${seg.arrivalDate}T${seg.arrivalTime}:00`);
            return isNaN(d.getTime()) ? null : d;
        }
        const depart = getDepartDate(seg);
        if (!depart) return null;
        return new Date(depart.getTime() + 2 * 60 * 60 * 1000);
    };

    const formatDuration = (ms) => {
        const totalMin = Math.round(ms / 60000);
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        if (h <= 0) return `${m} 分`;
        if (m === 0) return `${h} 小時`;
        return `${h} 小時 ${m} 分`;
    };

    const startEditing = (tripId, currentLabel) => {
        setEditingLabelId(tripId);
        setEditLabelValue(currentLabel || "");
    };

    const saveLabel = (tripId) => {
        onUpdateLabel(tripId, editLabelValue);
        setEditingLabelId(null);
    };

    const cancelEditing = () => {
        setEditingLabelId(null);
        setEditLabelValue("");
    };

    if (!trips || trips.length === 0) return (
        <div className="p-12 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
            尚無完整的配對行程
        </div>
    );

    const [showFuture, setShowFuture] = useState(true);
    const [showPast, setShowPast] = useState(true);

    const futureTrips = trips.filter(t => !t.isPast);
    const pastTrips = trips.filter(t => t.isPast);

    return (
        <div className="space-y-6">
            {hasOverrides && (
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={onClearAllOverrides}
                        className="text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                        title="清除所有手動重組/移除的設定"
                    >
                        清除手動重組
                    </button>
                </div>
            )}
            {/* 未來行程區塊 */}
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
                {showFuture && futureTrips.map((trip, index) => {
                const comboKey = trip.id;

                // 直接讀取 decoratedTrips 已計算的欄位
                const segments = Array.isArray(trip.segments) && trip.segments.length > 0
                    ? trip.segments
                    : (() => {
                        const segs = [];
                        if (trip.outbound) segs.push(trip.outbound);
                        segs.push(...(trip.connections || []));
                        if (trip.inbound) segs.push(trip.inbound);
                        return segs;
                    })();

                const totalCostTWD = trip.totalCostTWD ?? 0;
                const isOpenJaw = trip.isOpenJaw ?? false;
                const tripDays = trip.tripDays ?? null;
                const costPerDay = trip.costPerDay ?? null;
                const isExternalOnly = trip.isExternalOnly;
                const customLabel = tripLabels[comboKey] || `Trip ${index + 1}`;
                const matchedHotels = trip.matchedHotels ?? [];

                const totalHotelCostTWD = trip.totalHotelCostTWD ?? 0;
                const grandTotalTWD = totalCostTWD + totalHotelCostTWD;

                return (
                    <div
                        key={comboKey}
                        onDragOver={(e) => handleTripDragOver(e, comboKey)}
                        onDragLeave={() => setDragOverTripId(null)}
                        onDrop={(e) => handleTripDrop(e, comboKey)}
                        className={`relative flex flex-col md:flex-row items-stretch bg-white border ${
                        isExternalOnly
                            ? 'border-blue-300'
                            : !trip.isComplete
                            ? 'border-amber-300'
                            : isOpenJaw
                            ? 'border-yellow-300'
                            : 'border-emerald-300'
                    } ${dragOverTripId === comboKey ? 'ring-2 ring-indigo-400' : ''} rounded-xl shadow-sm hover:shadow-md transition-shadow mt-4`}>
                        <div className={`absolute -top-3 -right-2 px-3 py-1 text-xs font-bold text-white rounded-full shadow-sm flex items-center z-20 ${
                            isExternalOnly
                                ? 'bg-blue-500'
                                : !trip.isComplete
                                ? 'bg-amber-500'
                                : isOpenJaw
                                ? 'bg-yellow-500'
                                : 'bg-emerald-500'
                        }`}>
                            {isExternalOnly
                                ? <CheckCircle2 className="w-3 h-3 mr-1" />
                                : !trip.isComplete
                                ? <AlertTriangle className="w-3 h-3 mr-1" />
                                : isOpenJaw
                                ? <AlertTriangle className="w-3 h-3 mr-1" />
                                : <CheckCircle2 className="w-3 h-3 mr-1" />
                            }
                            {isExternalOnly
                                ? '外站獨立行程'
                                : !trip.isComplete
                                ? '未完結行程'
                                : isOpenJaw
                                ? '不同點進出'
                                : '配對成功'}
                            {tripDays && <span className="ml-2 pl-2 border-l border-white/30">共 {tripDays} 天</span>}
                        </div>
                        <div className="bg-slate-50 border-r border-slate-200 p-5 flex flex-col justify-center items-center rounded-l-xl w-full md:w-56 shrink-0 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-slate-200/50 to-transparent rounded-bl-full pointer-events-none"></div>
                            {editingLabelId === comboKey ? (
                                <div className="flex flex-col gap-2 w-full mt-2 relative z-10">
                                    <input autoFocus type="text" className="w-full text-sm p-1.5 border border-indigo-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500" value={editLabelValue} onChange={e => setEditLabelValue(e.target.value)} placeholder="自訂行程名稱..." onKeyDown={(e) => e.key === 'Enter' && saveLabel(comboKey)} />
                                    <div className="flex justify-end gap-1">
                                        <button onClick={() => saveLabel(comboKey)} className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200"><Check className="w-3.5 h-3.5" /></button>
                                        <button onClick={cancelEditing} className="p-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"><X className="w-3.5 h-3.5" /></button>
                                    </div>
                                </div>
                            ) : (
                                <div className="group flex items-center gap-1.5 text-slate-800 font-black text-xl mb-3 text-center relative cursor-pointer z-10" onClick={() => startEditing(comboKey, tripLabels[comboKey])}>
                                    <span>{customLabel}</span>
                                    <Edit3 className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                                </div>
                            )}
                            <div className="text-2xl font-black text-slate-900 mb-1 tracking-tight">
                                NT$ {Math.round(grandTotalTWD).toLocaleString()}
                            </div>
                            {totalHotelCostTWD > 0 && (
                                <div className="text-[10px] text-slate-500 mb-1">
                                    機票 {Math.round(totalCostTWD).toLocaleString()} + 住宿 {Math.round(totalHotelCostTWD).toLocaleString()}
                                </div>
                            )}
                            {costPerDay && (
                                <div className="text-[10px] font-bold text-indigo-900 bg-indigo-100/80 px-2 py-1 rounded-md border border-indigo-200 mt-1">
                                    每日預算：約 NT$ {Math.round(grandTotalTWD / tripDays).toLocaleString()}
                                </div>
                            )}
                            <div className="text-xs font-bold text-slate-400 bg-slate-200/50 px-2 py-1.5 rounded-md mt-1 border border-slate-200/50">
                                🛫 共 {segments.length} 段航班
                            </div>
                        </div>
                        <div className="flex-1 p-5 lg:p-6 flex flex-col justify-center gap-3 bg-white rounded-r-xl">
                            {segments.map((seg, i) => {
                                const arrival = getArrivalDate(seg);
                                const nextDepart = i < segments.length - 1 ? getDepartDate(segments[i + 1]) : null;
                                const layoverMs = arrival && nextDepart ? nextDepart - arrival : null;
                                const layoverText = layoverMs !== null && layoverMs >= 0 ? formatDuration(layoverMs) : null;
                                const layoverCode = (seg?.to || '').split(' ')[0] || '';

                                return (
                                    <React.Fragment key={seg.id || i}>
                                        <div
                                            draggable
                                            onDragStart={(e) => handleSegDragStart(e, seg.id)}
                                            className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50/80 rounded-xl hover:bg-indigo-50/50 hover:border-indigo-100 transition-all border border-slate-100 shadow-sm hover:shadow cursor-grab active:cursor-grabbing"
                                            title="可拖曳到其他趟次"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-slate-200 group-hover:bg-indigo-100 transition-colors flex items-center justify-center shrink-0 border border-slate-300 group-hover:border-indigo-200 shadow-inner">
                                                    {i === 0 ? <PlaneTakeoff className="w-5 h-5 text-slate-600 group-hover:text-indigo-600" /> :
                                                     i === segments.length - 1 ? <PlaneLanding className="w-5 h-5 text-slate-600 group-hover:text-indigo-600" /> :
                                                     <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-indigo-600" />}
                                                </div>
                                                <div>
                                                    <div className="text-xs font-bold text-indigo-500 mb-1 tracking-wide flex items-center gap-2 flex-wrap">
                                                        <span>{seg.ticket.airline}</span>
                                                        {seg.flightNo && (
                                                            <a href={`https://flightaware.com/live/flight/${seg.flightNo}`} target="_blank" rel="noreferrer" className="inline-flex items-center text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-mono px-1.5 py-0.5 rounded border border-indigo-200 transition-colors shadow-sm" title="前往 FlightAware 觀看航班動態" onClick={(e) => e.stopPropagation()}>
                                                                {seg.flightNo} ↗
                                                            </a>
                                                        )}
                                                    </div>
                                                    <div className="text-base font-bold text-slate-700 flex items-center flex-wrap gap-2">
                                                        {seg.from} <ArrowRight className="w-3 h-3 text-slate-400" /> {seg.to}
                                                    </div>
                                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                                        <button
                                                            type="button"
                                                            className="text-[11px] font-bold px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                                                            onClick={() => onRemoveSegment?.(seg.id)}
                                                            title="從趟次中移除這段航班"
                                                        >
                                                            從趟次移除
                                                        </button>
                                                        <label className="text-[11px] font-bold text-slate-500">
                                                            移到
                                                            <select
                                                                className="ml-2 text-[11px] font-bold px-2 py-1 rounded border border-slate-200 bg-white text-slate-700"
                                                                value={comboKey}
                                                                onChange={(e) => onMoveSegmentToTrip?.(seg.id, e.target.value)}
                                                            >
                                                                {tripIdOptions.map(id => (
                                                                    <option key={id} value={id}>{id}</option>
                                                                ))}
                                                            </select>
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col sm:items-end gap-1.5 pt-3 sm:pt-0 border-t border-dashed sm:border-0 border-slate-200">
                                                <div className="text-sm font-extrabold text-slate-700 bg-white px-3 py-2 rounded-lg shadow-sm border border-slate-200 flex items-center mb-1 ring-1 ring-slate-100">
                                                    <span>{formatDateWithDay(seg.date)}</span>
                                                    {seg.time && <span className="ml-3 pl-3 border-l-2 border-slate-100 text-indigo-600 flex items-center text-base"><Clock className="w-4 h-4 mr-1.5 text-indigo-400"/>{seg.time}</span>}
                                                </div>
                                                <div className="text-[11px] text-slate-400 font-medium px-1 uppercase tracking-wider">
                                                    系統單段成本: NT$ {Math.round(seg.ticket.type === 'oneway' ? seg.ticket.priceTWD : seg.ticket.priceTWD/2).toLocaleString()}
                                                </div>
                                            </div>
                                        </div>

                                        {layoverText && (
                                            <div className="flex items-center justify-center gap-2 py-1.5 px-4 -mt-1 bg-amber-50 border border-dashed border-amber-300 rounded-xl text-amber-700 text-[12px] font-bold">
                                                <Plane className="w-3.5 h-3.5 rotate-90 shrink-0" />
                                                {layoverCode || '転機'} 轉機 {layoverText}
                                            </div>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                            {/* ── 住宿卡片區 ──────────────────────────────── */}
                            {matchedHotels.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-teal-100 space-y-2">
                                    <div className="text-xs font-bold text-teal-600 uppercase tracking-wider mb-1 flex items-center gap-1">
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
                })}
            </div>

            {/* 歷史行程區塊 */}
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
                {showPast && pastTrips.map((trip, index) => {
                const comboKey = trip.id;

                // 直接讀取 decoratedTrips 已計算的欄位
                const segments = Array.isArray(trip.segments) && trip.segments.length > 0
                    ? trip.segments
                    : (() => {
                        const segs = [];
                        if (trip.outbound) segs.push(trip.outbound);
                        segs.push(...(trip.connections || []));
                        if (trip.inbound) segs.push(trip.inbound);
                        return segs;
                    })();

                const totalCostTWD = trip.totalCostTWD ?? 0;
                const isOpenJaw = trip.isOpenJaw ?? false;
                const tripDays = trip.tripDays ?? null;
                const isExternalOnly = trip.isExternalOnly;
                const customLabel = tripLabels[comboKey] || `Trip ${index + 1}`;
                const matchedHotels = trip.matchedHotels ?? [];
                const totalHotelCostTWD = trip.totalHotelCostTWD ?? 0;
                const grandTotalTWD = totalCostTWD + totalHotelCostTWD;

                return (
                    <div
                        key={comboKey}
                        onDragOver={(e) => handleTripDragOver(e, comboKey)}
                        onDragLeave={() => setDragOverTripId(null)}
                        onDrop={(e) => handleTripDrop(e, comboKey)}
                        className={`relative flex flex-col md:flex-row items-stretch bg-white border ${
                        isExternalOnly
                            ? 'border-blue-300'
                            : !trip.isComplete
                            ? 'border-amber-300'
                            : isOpenJaw
                            ? 'border-yellow-300'
                            : 'border-emerald-300'
                    } ${dragOverTripId === comboKey ? 'ring-2 ring-indigo-400' : ''} rounded-xl shadow-sm hover:shadow-md transition-shadow mt-4`}>
                        <div className={`absolute -top-3 -right-2 px-3 py-1 text-xs font-bold text-white rounded-full shadow-sm flex items-center z-20 ${
                            isExternalOnly
                                ? 'bg-blue-500'
                                : !trip.isComplete
                                ? 'bg-amber-500'
                                : isOpenJaw
                                ? 'bg-yellow-500'
                                : 'bg-emerald-500'
                        }`}>
                            {isExternalOnly
                                ? <CheckCircle2 className="w-3 h-3 mr-1" />
                                : !trip.isComplete
                                ? <AlertTriangle className="w-3 h-3 mr-1" />
                                : isOpenJaw
                                ? <AlertTriangle className="w-3 h-3 mr-1" />
                                : <CheckCircle2 className="w-3 h-3 mr-1" />
                            }
                            {isExternalOnly
                                ? '外站獨立行程'
                                : !trip.isComplete
                                ? '未完結行程'
                                : isOpenJaw
                                ? '不同點進出'
                                : '配對成功'}
                            {tripDays && <span className="ml-2 pl-2 border-l border-white/30">共 {tripDays} 天</span>}
                        </div>
                        <div className="bg-slate-50 border-r border-slate-200 p-5 flex flex-col justify-center items-center rounded-l-xl w-full md:w-56 shrink-0 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-slate-200/50 to-transparent rounded-bl-full pointer-events-none"></div>
                            {editingLabelId === comboKey ? (
                                <div className="flex flex-col gap-2 w-full mt-2 relative z-10">
                                    <input autoFocus type="text" className="w-full text-sm p-1.5 border border-indigo-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500" value={editLabelValue} onChange={e => setEditLabelValue(e.target.value)} placeholder="自訂行程名稱..." onKeyDown={(e) => e.key === 'Enter' && saveLabel(comboKey)} />
                                    <div className="flex justify-end gap-1">
                                        <button onClick={() => saveLabel(comboKey)} className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200"><Check className="w-3.5 h-3.5" /></button>
                                        <button onClick={cancelEditing} className="p-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"><X className="w-3.5 h-3.5" /></button>
                                    </div>
                                </div>
                            ) : (
                                <div className="group flex items-center gap-1.5 text-slate-800 font-black text-xl mb-3 text-center relative cursor-pointer z-10" onClick={() => startEditing(comboKey, tripLabels[comboKey])}>
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
                            <div className="text-xs font-bold text-slate-400 bg-slate-200/50 px-2 py-1.5 rounded-md mt-1 border border-slate-200/50">
                                🛫 共 {segments.length} 段航班
                            </div>
                        </div>
                        <div className="flex-1 p-5 lg:p-6 flex flex-col justify-center gap-3 bg-white rounded-r-xl">
                            {segments.map((seg, i) => {
                                const arrival = getArrivalDate(seg);
                                const nextDepart = i < segments.length - 1 ? getDepartDate(segments[i + 1]) : null;
                                const layoverMs = arrival && nextDepart ? nextDepart - arrival : null;
                                const layoverText = layoverMs !== null && layoverMs >= 0 ? formatDuration(layoverMs) : null;
                                const layoverCode = (seg?.to || '').split(' ')[0] || '';

                                return (
                                    <React.Fragment key={seg.id || i}>
                                        <div
                                            draggable
                                            onDragStart={(e) => handleSegDragStart(e, seg.id)}
                                            className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50/80 rounded-xl hover:bg-indigo-50/50 hover:border-indigo-100 transition-all border border-slate-100 shadow-sm hover:shadow cursor-grab active:cursor-grabbing"
                                            title="可拖曳到其他趟次"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-slate-200 group-hover:bg-indigo-100 transition-colors flex items-center justify-center shrink-0 border border-slate-300 group-hover:border-indigo-200 shadow-inner">
                                                    {i === 0 ? <PlaneTakeoff className="w-5 h-5 text-slate-600 group-hover:text-indigo-600" /> :
                                                     i === segments.length - 1 ? <PlaneLanding className="w-5 h-5 text-slate-600 group-hover:text-indigo-600" /> :
                                                     <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-indigo-600" />}
                                                </div>
                                                <div>
                                                    <div className="text-xs font-bold text-indigo-500 mb-1 tracking-wide flex items-center gap-2 flex-wrap">
                                                        <span>{seg.ticket.airline}</span>
                                                        {seg.flightNo && (
                                                            <a href={`https://flightaware.com/live/flight/${seg.flightNo}`} target="_blank" rel="noreferrer" className="inline-flex items-center text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-mono px-1.5 py-0.5 rounded border border-indigo-200 transition-colors shadow-sm" title="前往 FlightAware 觀看航班動態" onClick={(e) => e.stopPropagation()}>
                                                                {seg.flightNo} ↗
                                                            </a>
                                                        )}
                                                    </div>
                                                    <div className="text-base font-bold text-slate-700 flex items-center flex-wrap gap-2">
                                                        {seg.from} <ArrowRight className="w-3 h-3 text-slate-400" /> {seg.to}
                                                    </div>
                                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                                        <button
                                                            type="button"
                                                            className="text-[11px] font-bold px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                                                            onClick={() => onRemoveSegment?.(seg.id)}
                                                            title="從趟次中移除這段航班"
                                                        >
                                                            從趟次移除
                                                        </button>
                                                        <label className="text-[11px] font-bold text-slate-500">
                                                            移到
                                                            <select
                                                                className="ml-2 text-[11px] font-bold px-2 py-1 rounded border border-slate-200 bg-white text-slate-700"
                                                                value={comboKey}
                                                                onChange={(e) => onMoveSegmentToTrip?.(seg.id, e.target.value)}
                                                            >
                                                                {tripIdOptions.map(id => (
                                                                    <option key={id} value={id}>{id}</option>
                                                                ))}
                                                            </select>
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col sm:items-end gap-1.5 pt-3 sm:pt-0 border-t border-dashed sm:border-0 border-slate-200">
                                                <div className="text-sm font-extrabold text-slate-700 bg-white px-3 py-2 rounded-lg shadow-sm border border-slate-200 flex items-center mb-1 ring-1 ring-slate-100">
                                                    <span>{formatDateWithDay(seg.date)}</span>
                                                    {seg.time && <span className="ml-3 pl-3 border-l-2 border-slate-100 text-indigo-600 flex items-center text-base"><Clock className="w-4 h-4 mr-1.5 text-indigo-400"/>{seg.time}</span>}
                                                </div>
                                                <div className="text-[11px] text-slate-400 font-medium px-1 uppercase tracking-wider">
                                                    系統單段成本: NT$ {Math.round(seg.ticket.type === 'oneway' ? seg.ticket.priceTWD : seg.ticket.priceTWD/2).toLocaleString()}
                                                </div>
                                            </div>
                                        </div>

                                        {layoverText && (
                                            <div className="flex items-center justify-center gap-2 py-1.5 px-4 -mt-1 bg-amber-50 border border-dashed border-amber-300 rounded-xl text-amber-700 text-[12px] font-bold">
                                                <Plane className="w-3.5 h-3.5 rotate-90 shrink-0" />
                                                {layoverCode || '転機'} 轉機 {layoverText}
                                            </div>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                            {/* ── 住宿卡片區 ──────────────────────────────── */}
                            {matchedHotels.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-teal-100 space-y-2">
                                    <div className="text-xs font-bold text-teal-600 uppercase tracking-wider mb-1">
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
                })}
            </div>
        </div>
    );
}
