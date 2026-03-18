/**
 * HotelList.jsx ── 飯店住宿清單（管理列表）
 *
 * Props:
 *   hotels   {Array}    - useHotels 的 decoratedHotels
 *   onEdit   {Function} - (hotel) => void
 *   onDelete {Function} - (id) => void
 */
import React from 'react';
import { Building2, CalendarDays, Pencil, Trash2, Hash, MapPin, Clock, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

function HotelListItem({ hotel, onEdit, onDelete }) {
    const { id, name, address, checkIn, checkOut, totalNights, priceTWD, costPerNight, confirmationNo, isPast } = hotel;
    const [copiedId, setCopiedId] = React.useState(null);

    const handleCopy = (text, type) => {
        navigator.clipboard.writeText(text);
        setCopiedId(type);
        toast.success(`已複製${type === 'name' ? '飯店名稱' : '確認碼'}`);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const googleMapsUrl = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : '';


    return (
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border shadow-sm transition-all hover:shadow-md
            ${isPast ? 'bg-slate-50 border-slate-200' : 'bg-white border-teal-200'}`}>

            {/* 左側：圖示 + 基本資訊 */}
            <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border mt-0.5 sm:mt-0
                    ${isPast ? 'bg-slate-100 border-slate-300' : 'bg-teal-100 border-teal-300'}`}>
                    <Building2 className={`w-5 h-5 ${isPast ? 'text-slate-500' : 'text-teal-600'}`} />
                </div>
                <div className="min-w-0 w-full">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800 text-sm">{name}</span>
                        <button 
                            onClick={() => handleCopy(name, 'name')}
                            className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-teal-600 transition-colors"
                            title="複製飯店名稱"
                        >
                            {copiedId === 'name' ? <Check className="w-3 h-3 text-teal-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                        {isPast && (
                            <span className="text-[10px] font-bold bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full">
                                已完成
                            </span>
                        )}
                        {totalNights && (
                            <span className="text-[10px] font-bold bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">
                                {totalNights} 晚
                            </span>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        <span className="flex items-center text-xs text-slate-500">
                            <CalendarDays className="w-3 h-3 mr-1" />
                            {checkIn} → {checkOut}
                        </span>
                        {address && (
                            <a 
                                href={googleMapsUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center text-xs text-slate-400 hover:text-teal-600 transition-colors truncate max-w-[180px]"
                                title="在 Google Maps 中查看"
                            >
                                <MapPin className="w-3 h-3 mr-1 shrink-0" />
                                <span className="underline decoration-dotted underline-offset-2">{address}</span>
                            </a>
                        )}
                        {confirmationNo && (
                            <div className="flex items-center gap-1">
                                <span className="flex items-center text-xs font-mono text-slate-400">
                                    <Hash className="w-3 h-3 mr-1" />
                                    {confirmationNo}
                                </span>
                                <button 
                                    onClick={() => handleCopy(confirmationNo, 'conf')}
                                    className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-teal-600 transition-colors"
                                    title="複製確認碼"
                                >
                                    {copiedId === 'conf' ? <Check className="w-3 h-3 text-teal-500" /> : <Copy className="w-3 h-3" />}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 右側：費用 + 操作按鈕 */}
            <div className="flex items-center gap-3 justify-end sm:justify-normal shrink-0 mt-2 sm:mt-0 pt-3 border-t sm:border-t-0 sm:pt-0 border-slate-100">
                {priceTWD > 0 && (
                    <div className="text-right">
                        <div className="text-base font-extrabold text-teal-700">
                            NT$ {Math.round(priceTWD).toLocaleString()}
                        </div>
                        {costPerNight && (
                            <div className="text-[10px] text-slate-400">{costPerNight.toLocaleString()}/晚</div>
                        )}
                    </div>
                )}
                <button
                    onClick={() => onEdit(hotel)}
                    className="p-2 rounded-lg bg-slate-100 hover:bg-indigo-100 text-slate-500 hover:text-indigo-600 transition-colors"
                    title="編輯住宿"
                >
                    <Pencil className="w-4 h-4" />
                </button>
                <button
                    onClick={() => onDelete(id)}
                    className="p-2 rounded-lg bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-500 transition-colors"
                    title="刪除住宿"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

export default function HotelList({ hotels, onEdit, onDelete }) {
    if (!hotels || hotels.length === 0) {
        return (
            <div className="p-12 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                <Building2 className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <p className="font-bold">尚無住宿記錄</p>
                <p className="text-sm mt-1">在上方表單新增飯店或旅宿住宿資訊</p>
            </div>
        );
    }

    const futureHotels = hotels.filter(h => !h.isPast);
    const pastHotels   = hotels.filter(h => h.isPast);

    return (
        <div className="space-y-6">
            {futureHotels.length > 0 && (
                <div>
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Clock className="w-4 h-4" /> 即將入住
                    </h3>
                    <div className="space-y-3">
                        {futureHotels.map(h => (
                            <HotelListItem key={h.id} hotel={h} onEdit={onEdit} onDelete={onDelete} />
                        ))}
                    </div>
                </div>
            )}
            {pastHotels.length > 0 && (
                <div>
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Clock className="w-4 h-4 opacity-50" /> 已完成住宿
                    </h3>
                    <div className="space-y-3 opacity-70">
                        {pastHotels.map(h => (
                            <HotelListItem key={h.id} hotel={h} onEdit={onEdit} onDelete={onDelete} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
