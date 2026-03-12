import React, { useState } from 'react';
import { AlertTriangle, ArrowRight, Edit3, Check, X, PlaneTakeoff, PlaneLanding, Clock, CheckCircle2 } from 'lucide-react';
import { formatDateWithDay, calculateTripDays } from '../utils/dateHelpers';

export default function TripTimeline({ trips, tripLabels, onUpdateLabel }) {
    const [editingLabelId, setEditingLabelId] = useState(null);
    const [editLabelValue, setEditLabelValue] = useState("");

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

    return (
        <div className="space-y-6">
            {trips.map((trip, index) => {
                const comboKey = trip.id;
                
                const segments = [];
                if (trip.outbound) segments.push(trip.outbound);
                segments.push(...trip.connections);
                if (trip.inbound) segments.push(trip.inbound);

                const totalCostTWD = segments.reduce((sum, seg) => {
                    const cost = seg.ticket.type === 'oneway' ? seg.ticket.priceTWD : seg.ticket.priceTWD / 2;
                    return sum + cost;
                }, 0);

                const customLabel = tripLabels[comboKey] || `Trip ${index + 1}`;

                let isOpenJaw = false;
                if (trip.outbound && trip.inbound && trip.connections.length === 0) {
                    const outCode = trip.outbound.to.split(' ')[0];
                    const inCode = trip.inbound.from.split(' ')[0];
                    if (outCode !== inCode) isOpenJaw = true;
                }

                let tripDays = null;
                if (trip.isComplete && trip.outbound && trip.inbound) {
                    tripDays = calculateTripDays(trip.outbound.date, trip.inbound.date);
                }

                const isExternalOnly = trip.isExternalOnly;

                return (
                    <div key={comboKey} className={`relative flex flex-col md:flex-row items-stretch bg-white border ${!trip.isComplete ? 'border-amber-300' : isOpenJaw ? 'border-yellow-300' : 'border-emerald-300'} rounded-xl shadow-sm hover:shadow-md transition-shadow mt-4`}>
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
                            <div className="text-2xl font-black text-indigo-600 mb-1 tracking-tight">
                                NT$ {Math.round(totalCostTWD).toLocaleString()}
                            </div>
                            <div className="text-xs font-bold text-slate-400 bg-slate-200/50 px-2 py-1.5 rounded-md mt-1 border border-slate-200/50">
                                🛫 共 {segments.length} 段航班
                            </div>
                        </div>
                        <div className="flex-1 p-5 lg:p-6 flex flex-col justify-center gap-3 bg-white rounded-r-xl">
                            {segments.map((seg, i) => (
                                <div key={i} className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50/80 rounded-xl hover:bg-indigo-50/50 hover:border-indigo-100 transition-all border border-slate-100 shadow-sm hover:shadow">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-slate-200 group-hover:bg-indigo-100 transition-colors flex items-center justify-center shrink-0 border border-slate-300 group-hover:border-indigo-200 shadow-inner">
                                            {i === 0 && trip.outbound ? <PlaneTakeoff className="w-5 h-5 text-slate-600 group-hover:text-indigo-600" /> :
                                             i === segments.length - 1 && trip.inbound ? <PlaneLanding className="w-5 h-5 text-slate-600 group-hover:text-indigo-600" /> :
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
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
