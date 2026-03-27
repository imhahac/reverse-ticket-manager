import React from 'react';
import { Plane, Hotel, Ticket, ArrowRight, MapPin } from 'lucide-react';
import { formatDateWithDay } from '../../utils/dateHelpers';
import HotelStayCard from '../../features/hotels/components/HotelStayCard';

const categoryIcon = {
    attraction: '🎢',
    transport: '🚆',
    dining: '🍽️',
    voucher: '🎫'
};

export default function TripCategoryView({ 
    segments, matchedHotels, matchedActivities, layovers, onSelectHotelForMap 
}) {
    return (
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
                        {matchedHotels.map(hotel => <HotelStayCard key={hotel.id} hotel={hotel} className="shadow-sm border-slate-100" onClick={() => onSelectHotelForMap?.(hotel)} />)}
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
    );
}
