import React from 'react';
import { Trash2, Calendar, Clock } from 'lucide-react';

export default function TicketList({ tickets, onDelete }) {
    if (tickets.length === 0) return (
        <div className="p-8 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
            尚未購買機票，請上方新增
        </div>
    );

    return (
        <div className="bg-white rounded-xl shadow border border-gray-100 mt-6">
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
                                            <Calendar className="w-3 h-3 mr-1" /> {ticket.outboundDate}
                                            {ticket.outboundTime && <><Clock className="w-3 h-3 ml-2 mr-1" /> {ticket.outboundTime}</>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900 font-medium">{Segment2}</div>
                                        {ticket.type !== 'oneway' && (
                                            <div className="text-sm text-gray-500 mt-1 flex items-center">
                                                <Calendar className="w-3 h-3 mr-1" /> {ticket.inboundDate}
                                                {ticket.inboundTime && <><Clock className="w-3 h-3 ml-2 mr-1" /> {ticket.inboundTime}</>}
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
                                        <button onClick={() => onDelete(ticket.id)} className="text-red-500 hover:text-red-700 p-2 rounded hover:bg-red-50 transition">
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
