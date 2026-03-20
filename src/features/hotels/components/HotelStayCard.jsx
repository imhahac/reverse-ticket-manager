/**
 * HotelStayCard.jsx ── Timeline 內的住宿卡片（緊湊樣式）
 *
 * 在 TripTimeline 的每個趟次卡片底部，顯示符合日期範圍的飯店住宿。
 *
 * Props:
 *   hotel  {Object} - 來自 useHotels 的已裝飾飯店物件
 */
import React from 'react';
import { Building2, CalendarDays, Hash, MapPin } from 'lucide-react';

export default function HotelStayCard({ hotel }) {
    const { name, address, checkIn, checkOut, totalNights, currency, priceTotal, priceTWD, costPerNight, confirmationNo } = hotel;

    return (
        <div className="flex items-start gap-3 pl-3 pr-4 py-3 bg-teal-50/80 rounded-xl border border-teal-200 shadow-sm">
            {/* 圖示 */}
            <div className="w-9 h-9 rounded-full bg-teal-100 border border-teal-300 flex items-center justify-center shrink-0 mt-0.5">
                <Building2 className="w-4 h-4 text-teal-600" />
            </div>

            {/* 內容 */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-teal-800">{name}</span>
                    {totalNights && (
                        <span className="text-[11px] font-bold bg-teal-200/60 text-teal-700 px-2 py-0.5 rounded-full">
                            {totalNights} 晚
                        </span>
                    )}
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                    {/* 入住-退房 */}
                    <span className="flex items-center text-xs text-teal-700">
                        <CalendarDays className="w-3 h-3 mr-1 shrink-0" />
                        {checkIn} → {checkOut}
                    </span>
                    {/* 地址 */}
                    {address && (
                        <span className="flex items-center text-xs text-teal-600 truncate max-w-[200px]">
                            <MapPin className="w-3 h-3 mr-1 shrink-0" />
                            {address}
                        </span>
                    )}
                    {/* 確認碼 */}
                    {confirmationNo && (
                        <span className="flex items-center text-xs font-mono text-teal-600">
                            <Hash className="w-3 h-3 mr-1 shrink-0" />
                            {confirmationNo}
                        </span>
                    )}
                </div>
            </div>

            {/* 費用 */}
            {priceTWD > 0 && (
                <div className="text-right shrink-0">
                    <div className="text-sm font-extrabold text-teal-700">
                        NT$ {Math.round(priceTWD).toLocaleString()}
                    </div>
                    {currency !== 'TWD' && priceTotal > 0 && (
                        <div className="text-[10px] text-teal-600 font-medium">
                            {currency} {priceTotal.toLocaleString()}
                        </div>
                    )}
                    {costPerNight && (
                        <div className="text-[10px] text-teal-500">
                            {costPerNight.toLocaleString()}/晚
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
