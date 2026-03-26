import React from 'react';
import { Trash2, Calendar, MapPin, Edit2, Tag } from 'lucide-react';
import { formatDateWithDay } from '../../../utils/dateHelpers';

export default function ActivityList({ activities, onDelete, onEdit }) {
    if (activities.length === 0) return (
        <div className="p-8 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl mt-4">
            尚未登錄任何票卷或活動，請於上方新增
        </div>
    );

    const categoryIcon = {
        attraction: '🎢',
        transport: '🚆',
        dining: '🍽️',
        voucher: '🎫'
    };

    return (
        <div className="mt-6 space-y-4">
            {activities.map(act => (
                <div key={act.id} className="bg-white p-4 rounded-xl shadow-sm border border-orange-100 hover:border-orange-300 transition flex flex-col md:flex-row gap-4 relative group">
                    {/* 左側資訊區 */}
                    <div className="flex-1 flex flex-col gap-2">
                        <div className="flex items-start gap-2">
                            <span className="text-2xl mt-0.5" title={act.category}>{categoryIcon[act.category] || '🎫'}</span>
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">{act.title}</h3>
                                <div className="flex flex-wrap items-center text-sm font-bold text-orange-600 mt-1 bg-orange-50 w-fit px-2 py-0.5 rounded-md border border-orange-100">
                                    <Calendar className="w-3.5 h-3.5 mr-1" />
                                    {formatDateWithDay(act.startDate)}
                                    {act.endDate && act.endDate !== act.startDate && ` ➔ ${formatDateWithDay(act.endDate)}`}
                                    {act.time && <span className="ml-2 font-mono text-orange-500">[{act.time}]</span>}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center text-sm text-gray-600 mt-1">
                            <MapPin className="w-4 h-4 mr-1 text-gray-400" />
                            {act.location} {act.lat && act.lng && <span className="text-[10px] ml-1 text-emerald-500 font-bold border border-emerald-200 px-1 rounded bg-emerald-50">已定位</span>}
                        </div>
                        {act.notes && (
                            <div className="flex items-start text-xs text-gray-500 bg-gray-50 p-2 rounded border border-gray-100">
                                <Tag className="w-3 h-3 mr-1.5 mt-0.5 shrink-0" />
                                <span className="leading-relaxed">{act.notes}</span>
                            </div>
                        )}
                    </div>
                    {/* 右側價錢與操作 */}
                    <div className="flex flex-row md:flex-col justify-between md:justify-center items-center md:items-end border-t md:border-t-0 md:border-l border-gray-100 pt-3 md:pt-0 md:pl-4 shrink-0 gap-3">
                        <div className="text-left md:text-right">
                            <div className="text-xl font-black text-gray-800">NT$ {act.priceTWD?.toLocaleString()}</div>
                            {act.currency !== 'TWD' && <div className="text-xs text-gray-400 font-medium">{act.currency} {act.price?.toLocaleString()}</div>}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => onEdit(act)} className="text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 p-2 rounded-lg transition" title="修改">
                                <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => onDelete(act.id)} className="text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition" title="刪除">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}