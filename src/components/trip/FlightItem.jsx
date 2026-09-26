import React from 'react';
import { ArrowRight, PlaneTakeoff, PlaneLanding, Clock } from 'lucide-react';
import { formatDateWithDay } from '../../utils/dateHelpers';
import { getFlightAwareUrl } from '../../utils/flightUtils';

const FlightItem = ({ 
    seg, isFirst, isLast, onRemove, onMove, onSelectMap, comboKey, tripIdOptions 
}) => {
    return (
        <div
            className="group flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 sm:p-4 bg-slate-50/80 rounded-xl hover:bg-indigo-50/50 hover:border-indigo-100 transition-all border border-slate-100 shadow-sm hover:shadow w-full min-w-0 overflow-hidden"
        >
            <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-full bg-slate-200 group-hover:bg-indigo-100 transition-colors flex items-center justify-center shrink-0 border border-slate-300 group-hover:border-indigo-200 shadow-inner mt-0.5">
                    {isFirst ? (
                        <PlaneTakeoff className="w-4 h-4 text-slate-600 group-hover:text-indigo-600" />
                    ) : isLast ? (
                        <PlaneLanding className="w-4 h-4 text-slate-600 group-hover:text-indigo-600" />
                    ) : (
                        <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-600" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-indigo-500 mb-1 tracking-wide flex items-center gap-2 flex-wrap">
                        <span>{seg.ticket?.airline || '未知航空公司'}</span>
                        {seg.flightNo && (
                            <a
                                href={getFlightAwareUrl(seg.flightNo)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-mono px-1.5 py-0.5 rounded border border-indigo-200 transition-colors shadow-sm"
                                onClick={e => e.stopPropagation()}
                            >
                                {seg.flightNo} ↗
                            </a>
                        )}
                    </div>
                    <div className="text-sm sm:text-base font-bold text-slate-800 flex items-center flex-wrap gap-1.5 leading-snug break-words">
                        <span className="break-all">{seg.from}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0 inline-block mx-0.5" />
                        <span className="break-all">{seg.to}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <button type="button" className="text-[11px] font-bold px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition" onClick={() => onRemove?.(seg.id)}>
                            從趟次移除
                        </button>
                        <button type="button" onClick={() => onSelectMap?.(comboKey)} className="text-[11px] font-bold px-2 py-1 rounded border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition">
                            在地圖上查看
                        </button>
                        <select
                            className="text-[11px] font-bold px-2 py-1 rounded border border-slate-200 bg-white text-slate-700 max-w-[140px] truncate"
                            value={comboKey}
                            onChange={e => onMove?.(seg.id, e.target.value)}
                        >
                            {tripIdOptions.map(id => <option key={id} value={id}>{id}</option>)}
                        </select>
                    </div>
                </div>
            </div>
            <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-1.5 pt-2.5 md:pt-0 border-t border-dashed md:border-0 border-slate-200 shrink-0">
                <div className="text-xs sm:text-sm font-extrabold text-slate-700 bg-white px-2.5 py-1.5 rounded-lg shadow-sm border border-slate-200 flex items-center ring-1 ring-slate-100">
                    <span>{formatDateWithDay(seg.date)}</span>
                    {seg.time && (
                        <span className="ml-2 pl-2 border-l-2 border-slate-100 text-indigo-600 flex items-center text-xs sm:text-sm font-black">
                            <Clock className="w-3.5 h-3.5 mr-1 text-indigo-400 shrink-0" /> {seg.time}
                        </span>
                    )}
                </div>
                <div className="text-[10px] sm:text-[11px] text-slate-400 font-medium px-1 uppercase tracking-wider">
                    單段: NT$ {Math.round(seg.ticket?.type === 'oneway' ? (seg.ticket?.priceTWD || 0) : (seg.ticket?.priceTWD || 0) / 2).toLocaleString()}
                </div>
            </div>
        </div>
    );
};

export default React.memo(FlightItem);
