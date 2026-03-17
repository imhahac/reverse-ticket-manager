/**
 * TicketList.jsx ── 機票管理清單元件
 *
 * 職責：
 *   1. 渲染使用者購買的機票列表，支援正向票、反向票、單程票的不同佈局。
 *   2. 以表格形式呈現航段、日期、時間、航班編號與對應花費。
 *   3. 提供編輯 (onEdit) 與刪除 (onDelete) 入口。
 *
 * 注意事項：
 *   - 為避免行動裝置排版跑版，管理按鈕已用 div 包覆確保佈局穩定。
 */
import React from 'react';
import { Trash2, Calendar, Clock, Edit2 } from 'lucide-react';
import { formatDateWithDay } from '../utils/dateHelpers';

export default function TicketList({ tickets, onDelete, onEdit }) {
    if (tickets.length === 0) return (
        <div className="p-8 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
            尚未購買機票，請上方新增
        </div>
    );

    return (
        <div className="mt-6">
            {/* Mobile View: Cards */}
            <div className="md:hidden space-y-4">
                {tickets.map(ticket => {
                    const Segment1 = ticket.type === 'normal' || ticket.type === 'oneway'
                        ? `${ticket.departRegion} ✈️ ${ticket.returnRegion}`
                        : `${ticket.returnRegion} ✈️ ${ticket.departRegion}`;
                    const Segment2 = ticket.type === 'oneway'
                        ? '無 (單程票)'
                        : ticket.type === 'normal'
                            ? `${ticket.returnRegion} ✈️ ${ticket.departRegion}`
                            : `${ticket.departRegion} ✈️ ${ticket.returnRegion}`;

                    return (
                        <div key={ticket.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col gap-3 relative">
                            <div className="flex justify-between items-start">
                                <div className="flex flex-col gap-1.5">
                                    <span className={`px-2 py-1 inline-flex text-xs leading-4 font-bold rounded shadow-sm w-fit ${
                                        ticket.type === 'normal' ? 'bg-indigo-100 text-indigo-700' :
                                        ticket.type === 'reverse' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
                                    }`}>
                                        {ticket.type === 'normal' ? '正向票' : ticket.type === 'reverse' ? '反向票' : '單程票'}
                                    </span>
                                    <span className="text-sm font-bold text-gray-900">{ticket.airline}</span>
                                </div>
                                <div className="text-right">
                                    <div className="text-base font-black text-gray-800">NT$ {ticket.priceTWD?.toLocaleString() || Math.round(ticket.price).toLocaleString()}</div>
                                    {ticket.currency !== 'TWD' && <div className="text-xs text-gray-400 font-medium">{ticket.currency} {ticket.price.toLocaleString()}</div>}
                                </div>
                            </div>
                            
                            <div className="bg-gray-50 rounded-lg p-3 flex flex-col gap-2.5 border border-gray-100 text-sm mt-1">
                                <div>
                                    <div className="font-bold text-indigo-900">{Segment1}</div>
                                    <div className="text-gray-500 mt-1 text-xs flex flex-wrap items-center gap-y-1">
                                       <Calendar className="w-3 h-3 mr-1" /> {formatDateWithDay(ticket.outboundDate)}
                                       {ticket.outboundTime && <><Clock className="w-3 h-3 ml-2 mr-1 text-slate-400" /> {ticket.outboundTime}</>}
                                       {ticket.outboundFlightNo && <span className="ml-2 font-mono text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded shadow-sm">{ticket.outboundFlightNo}</span>}
                                    </div>
                                </div>
                                {ticket.type !== 'oneway' && (
                                    <div className="pt-2.5 border-t border-gray-200">
                                        <div className="font-bold text-indigo-900">{Segment2}</div>
                                        <div className="text-gray-500 mt-1 text-xs flex flex-wrap items-center gap-y-1">
                                           <Calendar className="w-3 h-3 mr-1" /> {formatDateWithDay(ticket.inboundDate)}
                                           {ticket.inboundTime && <><Clock className="w-3 h-3 ml-2 mr-1 text-slate-400" /> {ticket.inboundTime}</>}
                                           {ticket.inboundFlightNo && <span className="ml-2 font-mono text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded shadow-sm">{ticket.inboundFlightNo}</span>}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2 justify-end mt-2 pt-2 border-t border-gray-50">
                                <button onClick={() => onEdit(ticket)} className="flex items-center text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg text-sm font-bold transition">
                                    <Edit2 className="w-4 h-4 mr-1" /> 修改
                                </button>
                                <button onClick={() => onDelete(ticket.id)} className="flex items-center text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg text-sm font-bold transition">
                                    <Trash2 className="w-4 h-4 mr-1" /> 刪除
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Desktop View: Table */}
            <div className="hidden md:block bg-white rounded-xl shadow border border-gray-100">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">票種/標籤</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">航段一 (去程)</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">航段二 (回程)</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">花費</th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">管理</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {tickets.map(ticket => {
                                const Segment1 = ticket.type === 'normal' || ticket.type === 'oneway'
                                    ? `${ticket.departRegion} ✈️ ${ticket.returnRegion}`
                                    : `${ticket.returnRegion} ✈️ ${ticket.departRegion}`;
                                const Segment2 = ticket.type === 'oneway'
                                    ? '無 (單程票)'
                                    : ticket.type === 'normal'
                                        ? `${ticket.returnRegion} ✈️ ${ticket.departRegion}`
                                        : `${ticket.departRegion} ✈️ ${ticket.returnRegion}`;

                                return (
                                    <tr key={ticket.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col items-start gap-1">
                                                <span className={`px-2 py-1 inline-flex text-xs leading-4 font-bold rounded shadow-sm ${ticket.type === 'normal' ? 'bg-indigo-100 text-indigo-700' :
                                                    ticket.type === 'reverse' ? 'bg-purple-100 text-purple-700' :
                                                        'bg-emerald-100 text-emerald-700'
                                                    }`}>
                                                    {ticket.type === 'normal' ? '正向票' : ticket.type === 'reverse' ? '反向票' : '單程票'}
                                                </span>
                                                <span className="text-sm font-medium text-gray-900">{ticket.airline}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900 font-medium">{Segment1}</div>
                                            <div className="text-sm text-gray-500 mt-1 flex items-center">
                                                <Calendar className="w-3 h-3 mr-1" /> {formatDateWithDay(ticket.outboundDate)}
                                                {ticket.outboundTime && <><Clock className="w-3 h-3 ml-2 mr-1 text-slate-400" /> {ticket.outboundTime}</>}
                                                {ticket.outboundFlightNo && <span className="ml-2 font-mono text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded shadow-sm">{ticket.outboundFlightNo}</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900 font-medium">{Segment2}</div>
                                            {ticket.type !== 'oneway' && (
                                                <div className="text-sm text-gray-500 mt-1 flex items-center">
                                                    <Calendar className="w-3 h-3 mr-1" /> {formatDateWithDay(ticket.inboundDate)}
                                                    {ticket.inboundTime && <><Clock className="w-3 h-3 ml-2 mr-1 text-slate-400" /> {ticket.inboundTime}</>}
                                                    {ticket.inboundFlightNo && <span className="ml-2 font-mono text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded shadow-sm">{ticket.inboundFlightNo}</span>}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-700">
                                            {ticket.currency === 'TWD' ? (
                                                `NT$ ${ticket.priceTWD?.toLocaleString() || ticket.price.toLocaleString()}`
                                            ) : (
                                                <div className="flex flex-col">
                                                    <span>NT$ {ticket.priceTWD?.toLocaleString() || Math.round(ticket.price).toLocaleString()}</span>
                                                    <span className="text-xs text-gray-400 font-normal">{ticket.currency} {ticket.price.toLocaleString()} (@{ticket.exchangeRate})</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex gap-2 justify-end">
                                                <button onClick={() => onEdit(ticket)} className="text-amber-500 hover:text-amber-700 p-2 rounded hover:bg-amber-50 transition" title="修改機票">
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => onDelete(ticket.id)} className="text-red-500 hover:text-red-700 p-2 rounded hover:bg-red-50 transition" title="刪除機票">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
