/**
 * TripCalendar.jsx ── 系統月曆檢視元件
 *
 * 修復記錄：
 *   v7.1 - 月曆改為週日起始
 *   v7.1 - 住宿警告改為直接使用 trip.hotelWarnings（來自 useItinerary），避免重複計算
 */
import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';

export default function TripCalendar({ trips = [], tripLabels = {} }) {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    // 展平所有航段與住宿
    const allSegments = trips.flatMap(t => t.segments || []);
    const allHotels   = trips.flatMap(t => t.matchedHotels || []);

    const getDaysInMonth  = (y, m) => new Date(y, m + 1, 0).getDate();

    // 週日起始：getDay() 回傳 0=週日，直接使用即可
    const getFirstDayOfMonth = (y, m) => new Date(y, m, 1).getDay(); // 0=Sun ... 6=Sat

    const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

    const year  = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay    = getFirstDayOfMonth(year, month);

    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    const isToday = (day) => {
        const today = new Date();
        return day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    };

    const toDateStr = (day) =>
        `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const getFlightsForDay = (day) => {
        const dateStr = toDateStr(day);
        return allSegments.filter(seg => seg.date === dateStr);
    };

    const getHotelsForDay = (day) => {
        const dateStr = toDateStr(day);
        return allHotels.filter(h => {
            if (!h.checkIn || !h.checkOut) return false;
            return dateStr >= h.checkIn && dateStr < h.checkOut;
        });
    };

    // ✅ 直接彙整 trips 中已計算好的 hotelWarnings，不重複計算
    const hotelWarnings = trips.flatMap(trip => {
        const warns = trip.hotelWarnings || [];
        if (!warns.length) return [];
        const label = tripLabels[trip.id] || `行程 ${trip.id}`;
        return warns.map(w => `[${label}] ${w.replace(/^⚠️\s*/, '')}`);
    }).map(w => `⚠️ ${w}`);

    // 週日起始的表頭
    const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
    const monthNames = ['一月','二月','三月','四月','五月','六月',
                        '七月','八月','九月','十月','十一月','十二月'];

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between p-4 bg-slate-50 border-b border-slate-100">
                <button onClick={prevMonth}
                    className="px-4 py-2 hover:bg-slate-200 rounded text-slate-600 font-bold transition">
                    ◀ 上個月
                </button>
                <h3 className="text-xl font-black text-slate-800">{year}年 {monthNames[month]}</h3>
                <button onClick={nextMonth}
                    className="px-4 py-2 hover:bg-slate-200 rounded text-slate-600 font-bold transition">
                    下個月 ▶
                </button>
            </div>

            {hotelWarnings.length > 0 && (
                <div className="p-3 bg-amber-50 border-b border-amber-200 space-y-1">
                    {hotelWarnings.map((w, i) => (
                        <div key={i} className="text-xs font-bold text-amber-700">{w}</div>
                    ))}
                </div>
            )}

            {/* 圖例 */}
            <div className="flex items-center gap-4 px-4 py-2 bg-slate-50 border-b border-slate-100
                text-[11px] font-bold text-slate-500">
                <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm bg-indigo-200 inline-block" />航班
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm bg-teal-100 border border-teal-300 inline-block" />住宿中
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm bg-teal-300 inline-block" />Check-in/out
                </span>
            </div>

            {/* 週表頭 */}
            <div className="grid grid-cols-7 gap-px bg-slate-200">
                {dayNames.map(d => (
                    <div key={d} className="bg-slate-50 p-2 text-center text-xs font-bold text-slate-500">
                        {d}
                    </div>
                ))}
            </div>

            {/* 日曆格子 */}
            <div className="grid grid-cols-7 gap-px bg-slate-200">
                {days.map((day, idx) => {
                    if (!day) return (
                        <div key={`empty-${idx}`} className="bg-slate-50/50 min-h-[100px]" />
                    );

                    const flights    = getFlightsForDay(day);
                    const stayHotels = getHotelsForDay(day);
                    const dStr       = toDateStr(day);
                    const hasCheckIn  = allHotels.some(h => h.checkIn  === dStr);
                    const hasCheckOut = allHotels.some(h => h.checkOut === dStr);
                    const hasStay    = stayHotels.length > 0;
                    const isFocus    = isToday(day);

                    return (
                        <div
                            key={day}
                            className={`min-h-[100px] p-1.5 transition-colors ${
                                isFocus
                                    ? 'bg-indigo-50'
                                    : hasStay || hasCheckIn || hasCheckOut
                                    ? 'bg-teal-50'
                                    : 'bg-white hover:bg-slate-50'
                            }`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={`w-6 h-6 flex items-center justify-center rounded-full
                                    text-xs font-bold ${isFocus ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}>
                                    {day}
                                </span>
                                <div className="flex gap-0.5">
                                    {flights.length > 0 && (
                                        <span className="text-[9px] font-bold text-indigo-500
                                            bg-indigo-100 px-1 rounded">
                                            {flights.length}✈
                                        </span>
                                    )}
                                    {(hasStay || hasCheckIn || hasCheckOut) && (
                                        <span className="text-[9px] font-bold text-teal-600
                                            bg-teal-100 px-1 rounded">
                                            🏨
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col gap-1 mt-0.5">
                                {/* 住宿區塊 */}
                                {allHotels.map((h, i) => {
                                    if (!h.checkIn || !h.checkOut) return null;
                                    const isIn  = h.checkIn  === dStr;
                                    const isOut = h.checkOut === dStr;
                                    const isStay = dStr > h.checkIn && dStr < h.checkOut;
                                    if (!isIn && !isOut && !isStay) return null;

                                    return (
                                        <div key={i} className={`p-1 rounded border text-[10px]
                                            font-bold leading-tight ${
                                            isOut && !isIn
                                                ? 'bg-teal-100 border-teal-300 text-teal-900'
                                                : 'bg-teal-50 border-teal-200 text-teal-800'
                                        }`}>
                                            {isIn  && <span className="text-[9px] bg-teal-500 text-white rounded px-0.5 mr-0.5">IN</span>}
                                            {isOut && <span className="text-[9px] bg-teal-600 text-white rounded px-0.5 mr-0.5">OUT</span>}
                                            <span className="truncate block">{h.name}</span>
                                        </div>
                                    );
                                })}

                                {/* 航班 */}
                                {flights.map((flight, i) => (
                                    <div key={i} className={`p-1 rounded-md border text-[10px] shadow-sm ${
                                        flight?.ticket?.type === 'normal'
                                            ? 'bg-indigo-50 border-indigo-200 text-indigo-800'
                                            : flight?.ticket?.type === 'reverse'
                                            ? 'bg-purple-50 border-purple-200 text-purple-800'
                                            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                    }`}>
                                        <div className="font-bold flex items-center justify-between
                                            mb-0.5 gap-0.5">
                                            <span className="truncate">
                                                {flight?.ticket?.airline || '未知航空公司'}
                                            </span>
                                            {flight.time && (
                                                <span className="font-mono text-[9px] shrink-0">
                                                    {flight.time}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-0.5 font-bold">
                                            <span className="truncate">{flight.from.split(' ')[0]}</span>
                                            <ArrowRight className="w-2.5 h-2.5 shrink-0 opacity-50" />
                                            <span className="truncate">{flight.to.split(' ')[0]}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}