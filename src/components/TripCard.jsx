import React from 'react';
import PropTypes from 'prop-types';
import {
    AlertTriangle, CheckCircle2, Ticket,
} from 'lucide-react';
import { formatDateWithDay } from '../utils/dateHelpers';
import { useTripSchedule } from '../hooks/useTripSchedule';

// 匯入子組件
import TripCostPanel from './trip/TripCostPanel';
import TripTimelineView from './trip/TripTimelineView';
import TripCategoryView from './trip/TripCategoryView';

const categoryIcon = {
    attraction: '🎢',
    transport: '🚆',
    dining: '🍽️',
    voucher: '🎫'
};


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
            <TripCostPanel
                comboKey={comboKey}
                grandTotalTWD={grandTotalTWD}
                totalCostTWD={totalCostTWD}
                totalHotelCostTWD={totalHotelCostTWD}
                tripDays={tripDays}
                segmentsCount={segments.length}
                customLabel={customLabel}
                editingLabelId={editingLabelId}
                editLabelValue={editLabelValue}
                setEditLabelValue={setEditLabelValue}
                onStartEditing={onStartEditing}
                onSaveLabel={onSaveLabel}
                onCancelEditing={onCancelEditing}
            />

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

                <div className="mt-2">
                    {displayOptions.viewMode === 'category' ? (
                        <TripCategoryView
                            segments={segments}
                            matchedHotels={matchedHotels}
                            matchedActivities={matchedActivities}
                            layovers={layovers}
                            onSelectHotelForMap={onSelectHotelForMap}
                        />
                    ) : (
                        <TripTimelineView
                            schedule={schedule}
                            displayOptions={displayOptions}
                            segments={segments}
                            layovers={layovers}
                            comboKey={comboKey}
                            tripIdOptions={tripIdOptions}
                            onRemoveSegment={onRemoveSegment}
                            onMoveSegmentToTrip={onMoveSegmentToTrip}
                            onSelectTripForMap={onSelectTripForMap}
                            onSelectHotelForMap={onSelectHotelForMap}
                        />
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
