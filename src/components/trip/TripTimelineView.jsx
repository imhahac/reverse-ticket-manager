import React from 'react';
import { Clock, Tag } from 'lucide-react';
import { formatDateWithDay } from '../../utils/dateHelpers';
import FlightItem from './FlightItem';
import HotelStayCard from '../../features/hotels/components/HotelStayCard';

const categoryIcon = {
    attraction: '🎢',
    transport: '🚆',
    dining: '🍽️',
    voucher: '🎫'
};

export default function TripTimelineView({ 
    schedule, displayOptions, segments, layovers, comboKey, tripIdOptions,
    onRemoveSegment, onMoveSegmentToTrip, onSelectTripForMap, onSelectHotelForMap
}) {
    return (
        <div className="space-y-0">
            {schedule.map(day => (
                <div key={day.dateStr} className="relative pl-6 md:pl-8 py-4 border-l-2 border-indigo-100 last:border-transparent">
                    <div className="absolute -left-[9px] top-5 w-4 h-4 rounded-full bg-indigo-500 border-[3px] border-white shadow-sm" />
                    <div className="flex items-baseline gap-2 mb-4">
                        <h4 className="text-lg font-black text-indigo-900">Day {day.dayNum}</h4>
                        <span className="text-sm font-bold text-slate-500">{formatDateWithDay(day.dateStr)}</span>
                    </div>
                    <div className="space-y-3">
                        {displayOptions.hotels && day.checkOuts.map(h => (
                            <div key={`out-${h.id}`} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 shadow-sm">
                                <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">OUT</span> 辦理退房：{h.name}
                            </div>
                        ))}
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
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-orange-900 text-base">{act.title}</div>
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
                            <div key={`in-${h.id}`} className="flex flex-col p-3 bg-teal-50 rounded-xl border border-teal-100 shadow-sm group hover:bg-teal-100/50 transition-colors cursor-pointer" onClick={() => onSelectHotelForMap?.(h)}>
                                <div className="flex items-center gap-2 font-bold text-teal-900 mb-2"><span className="bg-teal-500 text-white px-1.5 py-0.5 rounded text-[10px]">IN</span> 辦理入住：{h.name}</div>
                                <HotelStayCard hotel={h} />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
