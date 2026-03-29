import React from 'react';
import { ArrowRight, PlaneTakeoff, PlaneLanding, Clock } from 'lucide-react';
import { formatDateWithDay } from '../../utils/dateHelpers';
import { getFlightAwareUrl } from '../../utils/flightUtils';

export default function FlightItem({ 
    seg, isFirst, isLast, onRemove, onMove, onSelectMap, comboKey, tripIdOptions 
}) {
    return (
        <div
            className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50/80 rounded-xl hover:bg-indigo-50/50 hover:border-indigo-100 transition-all border border-slate-100 shadow-sm hover:shadow"
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
