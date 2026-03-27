import React from 'react';
import PropTypes from 'prop-types';
import { 
    AlertTriangle, ArrowRight, Edit3, Check, X, Hotel, PlaneTakeoff, 
    PlaneLanding, Clock, CheckCircle2, Plane, Ticket, Tag, MapPin, 
} from 'lucide-react';
import { formatDateWithDay } from '../utils/dateHelpers';
import HotelStayCard from '../features/hotels/components/HotelStayCard';
import { useTripSchedule } from '../hooks/useTripSchedule';

const categoryIcon = {
    attraction: '🎢',
    transport: '🚆',
    dining: '🍽️',
    voucher: '🎫'
};

// ── 子組件：航段項目 ─────────────────────────────────────────────────────────
function FlightItem({ seg, isFirst, isLast, layover, onRemove, onMove, onSelectMap, comboKey, tripIdOptions }) {
    return (
        <div
            draggable
            className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50/80 rounded-xl hover:bg-indigo-50/50 hover:border-indigo-100 transition-all border border-slate-100 shadow-sm hover:shadow cursor-grab active:cursor-grabbing"
            onDragStart={e => {
                try {
                    e.dataTransfer.setData('text/plain', seg.id);
                    e.dataTransfer.effectAllowed = 'move';
                } catch { /* ignore */ }
            }}
        >
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-200 group-hover:bg-indigo-100 transition-colors flex items-center justify-center shrink-0 border border-slate-300 group-hover:border-indigo-200 shadow-inner">
                    {isFirst ? (
                        <PlaneTakeoff className="w-5 h-5 text-slate-600 group-hover:text-indigo-600" />
                    ) : isLast ? (
                        <PlaneLanding className="w-5 h-5 text-slate-600 group-hover:text-indigo-600" />
                    ) : (
                        <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-indigo-600" />
                    )}
                </div>
                <div>
                    <div className="text-xs font-bold text-indigo-500 mb-1 tracking-wide flex items-center gap-2 flex-wrap">
                        <span>{seg.ticket?.airline || '未知航空公司'}</span>
                        {seg.flightNo && (
                            <a
                                href={`https://flightaware.com/live/flight/${seg.flightNo}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-mono px-1.5 py-0.5 rounded border border-indigo-200 transition-colors shadow-sm"
                                onClick={e => e.stopPropagation()}
                            >
                                {seg.flightNo} ↗
                            </a>
                        )}
                    </div>
                    <div className="text-base font-bold text-slate-700 flex items-center flex-wrap gap-2">
                        {seg.from} <ArrowRight className="w-3 h-3 text-slate-400" /> {seg.to}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button type="button" className="text-[11px] font-bold px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600" onClick={() => onRemove?.(seg.id)}>
                            從趟次移除
                        </button>
                        <button type="button" onClick={() => onSelectMap?.(comboKey)} className="text-[11px] font-bold px-2 py-1 rounded border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700">
                            在地圖上查看
                        </button>
                        <select
                            className="text-[11px] font-bold px-2 py-1 rounded border border-slate-200 bg-white text-slate-700"
                            value={comboKey}
                            onChange={e => onMove?.(seg.id, e.target.value)}
                        >
                            {tripIdOptions.map(id => <option key={id} value={id}>{id}</option>)}
                        </select>
                    </div>
                </div>
            </div>
            <div className="flex flex-col sm:items-end gap-1.5 pt-3 sm:pt-0 border-t border-dashed sm:border-0 border-slate-200">
                <div className="text-sm font-extrabold text-slate-700 bg-white px-3 py-2 rounded-lg shadow-sm border border-slate-200 flex items-center mb-1 ring-1 ring-slate-100">
                    <span>{formatDateWithDay(seg.date)}</span>
                    {seg.time && (
                        <span className="ml-3 pl-3 border-l-2 border-slate-100 text-indigo-600 flex items-center text-base">
                            <Clock className="w-4 h-4 mr-1.5 text-indigo-400" /> {seg.time}
                        </span>
                    )}
                </div>
                <div className="text-[11px] text-slate-400 font-medium px-1 uppercase tracking-wider">
                    系統單段成本: NT$ {Math.round(seg.ticket?.type === 'oneway' ? (seg.ticket?.priceTWD || 0) : (seg.ticket?.priceTWD || 0) / 2).toLocaleString()}
                </div>
            </div>
        </div>
    );
}

// ── TripCard 主組件 ──────────────────────────────────────────────────────────
export default function TripCard({
    trip, index, tripLabels, tripIdOptions, onRemoveSegment, onMoveSegmentToTrip,
    editingLabelId, editLabelValue, setEditLabelValue, onStartEditing, onSaveLabel, onCancelEditing,
    onSelectHotelForMap, displayOptions, onSelectTripForMap, dragOverTripId, setDragOverTripId,
    onSegDragStart, onTripDragOver, onTripDrop, getDepartDate, getArrivalDate, formatDuration,
}) {
    const comboKey = trip.id;
    const segments = trip.segments || [];
    const totalCostTWD = trip.totalCostTWD ?? 0;
    const totalHotelCostTWD = trip.totalHotelCostTWD ?? 0;
    const grandTotalTWD = totalCostTWD + totalHotelCostTWD;
    const isOpenJaw = trip.isOpenJaw ?? false;
    const tripDays = trip.tripDays ?? null;
    const isExternalOnly = trip.isExternalOnly;
    const customLabel = tripLabels[comboKey] || `Trip ${index + 1}`;
    const matchedHotels = trip.matchedHotels ?? [];
    const matchedActivities = trip.matchedActivities || [];
    const multiDayVouchers = matchedActivities.filter(a => a.endDate && a.endDate !== a.startDate);
    const hotelWarns = trip.hotelWarnings || [];

    const borderColor = isExternalOnly ? 'border-blue-300' : !trip.isComplete ? 'border-amber-300' : isOpenJaw ? 'border-yellow-300' : 'border-emerald-300';
    const badgeBg = isExternalOnly ? 'bg-blue-500' : !trip.isComplete ? 'bg-amber-500' : isOpenJaw ? 'bg-yellow-500' : 'bg-emerald-500';
    const badgeLabel = isExternalOnly ? '外站獨立行程' : !trip.isComplete ? '未完結行程' : isOpenJaw ? '不同點進出' : '配對成功';
    const BadgeIcon = (isExternalOnly || (trip.isComplete && !isOpenJaw)) ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <AlertTriangle className="w-3 h-3 mr-1" />;

    const layovers = {};
    segments.forEach((seg, i) => {
        const arrival = getArrivalDate(seg);
        const nextDepart = i < segments.length - 1 ? getDepartDate(segments[i + 1]) : null;
        const layoverMs = arrival && nextDepart ? nextDepart - arrival : null;
        if (layoverMs !== null && layoverMs >= 0) {
            layovers[seg.id] = { text: formatDuration(layoverMs), code: (seg.to || '').split(' ')[0] || '' };
        }
    });

    const schedule = useTripSchedule(segments, matchedHotels, matchedActivities);

    return (
        <div
            onDragOver={e => onTripDragOver(e, comboKey)}
            onDragLeave={() => setDragOverTripId(null)}
            onDrop={e => onTripDrop(e, comboKey)}
            className={`relative flex flex-col md:flex-row items-stretch bg-white border ${borderColor} ${dragOverTripId === comboKey ? 'ring-2 ring-indigo-400' : ''} rounded-xl shadow-sm hover:shadow-md transition-shadow mt-4`}
        >
            <div className={`absolute -top-3 -right-2 px-3 py-1 text-xs font-bold text-white rounded-full shadow-sm flex items-center z-20 ${badgeBg}`}>
                {BadgeIcon} {badgeLabel}
                {tripDays && <span className="ml-2 pl-2 border-l border-white/30">共 {tripDays} 天</span>}
            </div>

            {/* 左側成本面板 */}
            <div className="bg-slate-50 border-r border-slate-200 p-5 flex flex-col justify-center items-center rounded-l-xl w-full md:w-56 shrink-0 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-slate-200/50 to-transparent rounded-bl-full pointer-events-none" />
                {editingLabelId === comboKey ? (
                    <div className="flex flex-col gap-2 w-full mt-2 relative z-10">
                        <input autoFocus type="text" className="w-full text-sm p-1.5 border border-indigo-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500" value={editLabelValue} onChange={e => setEditLabelValue(e.target.value)} placeholder="自訂行程名稱..." onKeyDown={e => e.key === 'Enter' && onSaveLabel(comboKey)} />
                        <div className="flex justify-end gap-1">
                            <button onClick={() => onSaveLabel(comboKey)} className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={onCancelEditing} className="p-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"><X className="w-3.5 h-3.5" /></button>
                        </div>
                    </div>
                ) : (
                    <div className="group flex items-center gap-1.5 text-slate-800 font-black text-xl mb-3 text-center relative cursor-pointer z-10" onClick={() => onStartEditing(comboKey, tripLabels[comboKey])}>
                        <span>{customLabel}</span>
                        <Edit3 className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                    </div>
                )}
                <div className="text-2xl font-black text-slate-900 mb-1 tracking-tight">NT$ {Math.round(grandTotalTWD).toLocaleString()}</div>
                {totalHotelCostTWD > 0 && <div className="text-[10px] text-slate-500 mb-1 text-center">機票 {Math.round(totalCostTWD).toLocaleString()} + 住宿 {Math.round(totalHotelCostTWD).toLocaleString()}</div>}
                {tripDays && tripDays > 0 && (
                    <div className="text-[10px] font-bold text-indigo-900 bg-indigo-100/80 px-2 py-1.5 rounded-md border border-indigo-200 mt-2 flex flex-col items-center gap-0.5 shadow-sm">
                        <span className="text-[8px] uppercase tracking-tighter opacity-60">每日平均成本 (CP 值)</span>
                        <span>NT$ {Math.round(grandTotalTWD / tripDays).toLocaleString()} / 天</span>
                    </div>
                )}
                <div className="text-xs font-bold text-slate-400 bg-slate-200/50 px-2 py-1.5 rounded-md mt-1 border border-slate-200/50">🛫 共 {segments.length} 段航班</div>
            </div>

            {/* 右側列表 */}
            <div className="flex-1 p-5 lg:p-6 flex flex-col justify-center gap-3 bg-white rounded-r-xl">
                {hotelWarns.map((w, i) => <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-1 text-xs font-bold text-amber-700">{w}</div>)}
                
                {displayOptions.activities && multiDayVouchers.length > 0 && (
                    <div className="p-3 bg-orange-50/80 border border-orange-200 rounded-xl space-y-2 shadow-sm mb-2">
                        <div className="text-xs font-bold text-orange-800 uppercase flex items-center tracking-wider"><Ticket className="w-4 h-4 mr-1"/> 期間通用票券</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {multiDayVouchers.map(v => (
                                <div key={v.id} className="flex flex-col text-sm font-bold text-orange-900 bg-white p-2.5 rounded-lg border border-orange-100 shadow-sm">
                                    <div className="flex items-center gap-2 mb-1"><span>{categoryIcon[v.category] || '🎫'}</span> {v.title}</div>
                                    <div className="text-xs">
                                        <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-mono mr-2">{formatDateWithDay(v.startDate)} ~ {formatDateWithDay(v.endDate)}</span>
                                        {v.notes && <span className="text-orange-400 truncate">{v.notes}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="mt-2 space-y-0">
                    {displayOptions.viewMode === 'category' ? (
                        <div className="space-y-6 pt-2">
                            {segments.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest pl-2 border-l-2 border-slate-200"><Plane className="w-3.5 h-3.5" /> 航班段次</div>
                                    <div className="pl-4 space-y-3">
                                        {segments.map((seg, i) => (
                                            <div key={seg.id}>
                                                <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-[10px] font-bold bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">第 {i+1} 段</span>
                                                        <span className="text-[10px] font-mono text-slate-400">{formatDateWithDay(seg.date)} {seg.time}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 font-bold text-slate-800">{seg.from} <ArrowRight className="w-3 h-3 text-slate-300" /> {seg.to}</div>
                                                </div>
                                                {layovers[seg.id] && <div className="py-2 pl-4 border-l-2 border-dashed border-slate-200 ml-4 my-1 text-[10px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-100 w-fit">⏱️ 轉機停留 {layovers[seg.id].text} ({layovers[seg.id].code})</div>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {matchedHotels.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest pl-2 border-l-2 border-slate-200"><Hotel className="w-3.5 h-3.5" /> 住宿安排</div>
                                    <div className="pl-4 grid grid-cols-1 gap-3">
                                        {matchedHotels.map(hotel => <HotelStayCard key={hotel.id} hotel={hotel} className="shadow-sm border-slate-100" onClick={() => onSelectHotelForMap(hotel)} />)}
                                    </div>
                                </div>
                            )}

                            {matchedActivities.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest pl-2 border-l-2 border-slate-200"><Ticket className="w-3.5 h-3.5" /> 票券與活動</div>
                                    <div className="pl-4 grid grid-cols-1 gap-3">
                                        {matchedActivities.map(v => (
                                            <div key={v.id} className="flex flex-col text-sm font-bold text-slate-800 bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                                <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><span>{categoryIcon[v.category] || '🎫'}</span> {v.title}</div><span className="text-[10px] font-mono text-slate-400">{formatDateWithDay(v.startDate)}</span></div>
                                                {v.location && <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-1"><MapPin className="w-3 h-3" /> {v.location}</div>}
                                                {v.notes && <div className="text-[10px] text-slate-400 font-normal border-t border-slate-50 pt-1 mt-1">{v.notes}</div>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        schedule.map(day => (
                            <div key={day.dateStr} className="relative pl-6 md:pl-8 py-4 border-l-2 border-indigo-100 last:border-transparent">
                                <div className="absolute -left-[9px] top-5 w-4 h-4 rounded-full bg-indigo-500 border-[3px] border-white shadow-sm" />
                                <div className="flex items-baseline gap-2 mb-4">
                                    <h4 className="text-lg font-black text-indigo-900">Day {day.dayNum}</h4>
                                    <span className="text-sm font-bold text-slate-500">{formatDateWithDay(day.dateStr)}</span>
                                </div>
                                <div className="space-y-3">
                                    {displayOptions.hotels && day.checkOuts.map(h => <div key={`out-${h.id}`} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 shadow-sm"><span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">OUT</span> 辦理退房：{h.name}</div>)}
                                    {displayOptions.flights && day.flights.map((seg) => (
                                        <FlightItem 
                                            key={seg.id} seg={seg} isFirst={seg.id === segments[0].id} isLast={seg.id === segments[segments.length - 1].id}
                                            layover={layovers[seg.id]} onRemove={onRemoveSegment} onMove={onMoveSegmentToTrip} onSelectMap={onSelectTripForMap}
                                            comboKey={comboKey} tripIdOptions={tripIdOptions}
                                        />
                                    ))}
                                    {displayOptions.activities && day.activities.map(act => (
                                        <div key={act.id} className="flex items-start gap-3 p-3 bg-orange-50/50 rounded-xl border border-orange-100 shadow-sm">
                                            <div className="text-xl mt-0.5" title={act.category}>{categoryIcon[act.category] || '🎫'}</div>
                                            <div className="flex-1 min-w-0"><div className="font-bold text-orange-900 text-base">{act.title}</div>
                                                {(act.time || act.location || act.notes) && (
                                                    <div className="text-xs text-orange-700 mt-1.5 flex flex-wrap gap-2 items-center">
                                                        {act.time && <span className="font-mono bg-orange-100/80 border border-orange-200 px-1.5 py-0.5 rounded flex items-center"><Clock className="w-3 h-3 mr-1" />{act.time}</span>}
                                                        {act.location && <span className="truncate max-w-[200px]">📍 {act.location}</span>}
                                                        {act.notes && <span className="text-orange-500 truncate max-w-[200px] flex items-center border-l border-orange-200 pl-2"><Tag className="w-3 h-3 mr-1"/>{act.notes}</span>}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {displayOptions.hotels && day.checkIns.map(h => (
                                        <div key={`in-${h.id}`} className="flex flex-col p-3 bg-teal-50 rounded-xl border border-teal-100 shadow-sm group hover:bg-teal-100/50 transition-colors cursor-pointer" onClick={() => onSelectHotelForMap?.(h.id, comboKey)}>
                                            <div className="flex items-center gap-2 font-bold text-teal-900 mb-2"><span className="bg-teal-500 text-white px-1.5 py-0.5 rounded text-[10px]">IN</span> 辦理入住：{h.name}</div>
                                            <HotelStayCard hotel={h} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

TripCard.propTypes = {
    trip: PropTypes.object.isRequired,
    index: PropTypes.number.isRequired,
    tripLabels: PropTypes.object,
    tripIdOptions: PropTypes.array,
    onRemoveSegment: PropTypes.func,
    onMoveSegmentToTrip: PropTypes.func,
    editingLabelId: PropTypes.string,
    editLabelValue: PropTypes.string,
    setEditLabelValue: PropTypes.func,
    onStartEditing: PropTypes.func,
    onSaveLabel: PropTypes.func,
    onCancelEditing: PropTypes.func,
    onSelectHotelForMap: PropTypes.func,
    displayOptions: PropTypes.object,
    onSelectTripForMap: PropTypes.func,
    dragOverTripId: PropTypes.string,
    setDragOverTripId: PropTypes.func,
    onSegDragStart: PropTypes.func,
    onTripDragOver: PropTypes.func,
    onTripDrop: PropTypes.func,
    getDepartDate: PropTypes.func,
    getArrivalDate: PropTypes.func,
    formatDuration: PropTypes.func
};
