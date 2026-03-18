/**
 * TripCalendar.jsx ── 系統月曆檢視元件
 *
 * 職責：
 *   1. 渲染日曆網格，顯示每日的航班與住宿。
 *   2. 智慧偵測並提示「行程級別」的住宿缺口與重疊 (hotelWarnings)。
 *   3. 將 trips 打平為 allSegments 和 allHotels 進行日曆位置映射。
 *
 * 注意事項：
 *   - 這裡的告警邏輯是 per-trip 檢查，避免不同跨月行程間被誤判為住宿缺口。
 */
import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';

export default function TripCalendar({ trips = [], tripLabels = {} }) {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    // 展平所有航段與住宿供渲染使用
    const allSegments = trips.flatMap(t => t.segments || []);
    const allHotels   = trips.flatMap(t => t.matchedHotels || []);

    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const prevMonth = () =>
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    const nextMonth = () =>
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

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

    // 取得這天屬於哪些住宿（checkIn <= dateStr <= checkOut 前一天，即住宿期間內）
    const getHotelsForDay = (day) => {
        const dateStr = toDateStr(day);
        return allHotels.filter(h => {
            if (!h.checkIn || !h.checkOut) return false;
            return dateStr >= h.checkIn && dateStr < h.checkOut;
        });
    };

    const isCheckIn = (day) => {
        const dateStr = toDateStr(day);
        return allHotels.some(h => h.checkIn === dateStr);
    };

    const isCheckOut = (day) => {
        const dateStr = toDateStr(day);
        return allHotels.some(h => h.checkOut === dateStr);
    };

    // 住宿缺口與重疊警告 (以 Trip 為單位計算，避免 Trip 之間的假缺口)
    const hotelWarnings = (() => {
        const allWarns = [];
        trips.forEach(trip => {
            const matchedHotels = trip.matchedHotels ?? [];
            const label = tripLabels[trip.id] || `行程 ${trip.id}`;
            
            if (trip.tripDays > 1 && matchedHotels.length === 0) {
                allWarns.push(`⚠️ 「${label}」尚未安排任何住宿`);
                return;
            }
            
            const valid = matchedHotels.filter(h => h.checkIn && h.checkOut).sort((a, b) => a.checkIn.localeCompare(b.checkIn));
            for (let i = 0; i < valid.length - 1; i++) {
                const a = valid[i], b = valid[i + 1];
                if (b.checkIn < a.checkOut) allWarns.push(`⚠️「${label}」住宿重疊：${a.name} 與 ${b.name}`);
                else if (b.checkIn > a.checkOut) allWarns.push(`⚠️「${label}」住宿缺口：${a.checkOut} 到 ${b.checkIn}`);
            }
        });
        return allWarns;
    })();

    const monthNames = ["一月","二月","三月","四月","五月","六月","七月","八月","九月","十月","十一月","十二月"];
    const dayNames = ["日","一","二","三","四","五","六"];

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between p-4 bg-slate-50 border-b border-slate-100">
                <button onClick={prevMonth} className="px-4 py-2 hover:bg-slate-200 rounded text-slate-600 font-bold transition">◀ 上個月</button>
                <h3 className="text-xl font-black text-slate-800">{year}年 {monthNames[month]}</h3>
                <button onClick={nextMonth} className="px-4 py-2 hover:bg-slate-200 rounded text-slate-600 font-bold transition">下個月 ▶</button>
            </div>

            {hotelWarnings.length > 0 && (
                <div className="p-3 bg-amber-50 border-b border-amber-200 space-y-1">
                    {hotelWarnings.map((w, i) => (
                        <div key={i} className="text-xs font-bold text-amber-700">{w}</div>
                    ))}
                </div>
            )}

            {/* 圖例 */}
            <div className="flex items-center gap-4 px-4 py-2 bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-indigo-200 inline-block"></span>航班</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-teal-100 border border-teal-300 inline-block"></span>住宿中</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-teal-300 inline-block"></span>Check-in/out</span>
            </div>

            <div className="grid grid-cols-7 gap-px bg-slate-200">
                {dayNames.map(day => (
                    <div key={day} className="bg-slate-50 p-2 text-center text-xs font-bold text-slate-500">{day}</div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-px bg-slate-200">
                {days.map((day, idx) => {
                    if (!day) return <div key={`empty-${idx}`} className="bg-slate-50/50 min-h-[100px]"></div>;

                    const flights = getFlightsForDay(day);
                    const stayHotels = getHotelsForDay(day);
                    const checkIn = isCheckIn(day);
                    const checkOut = isCheckOut(day);
                    const isFocus = isToday(day);
                    const hasStay = stayHotels.length > 0;

                    return (
                        <div
                            key={day}
                            className={`min-h-[100px] p-1.5 transition-colors ${
                                isFocus
                                    ? 'bg-indigo-50'
                                    : hasStay || checkIn || checkOut
                                    ? 'bg-teal-50'
                                    : 'bg-white hover:bg-slate-50'
                            }`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                                    isFocus ? 'bg-indigo-600 text-white' : 'text-slate-600'
                                }`}>
                                    {day}
                                </span>
                                <div className="flex gap-0.5">
                                    {flights.length > 0 && (
                                        <span className="text-[9px] font-bold text-indigo-500 bg-indigo-100 px-1 rounded">{flights.length}✈</span>
                                    )}
                                    {(hasStay || checkIn || checkOut) && (
                                        <span className="text-[9px] font-bold text-teal-600 bg-teal-100 px-1 rounded">🏨</span>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col gap-1 mt-0.5">
                                {/* 住宿區塊 */}
                                {allHotels.map((h, i) => {
                                    const dStr = toDateStr(day);
                                    if (!h.checkIn || !h.checkOut) return null;
                                    
                                    const isCheckIn = h.checkIn === dStr;
                                    const isCheckOut = h.checkOut === dStr;
                                    const isStay = dStr > h.checkIn && dStr < h.checkOut;
                                    
                                    if (!isCheckIn && !isCheckOut && !isStay) return null;
                                    
                                    return (
                                        <div key={i} className={`p-1 rounded border text-[10px] font-bold leading-tight ${
                                            isCheckOut && !isCheckIn ? 'bg-teal-100 border-teal-300 text-teal-900' : 'bg-teal-50 border-teal-200 text-teal-800'
                                        }`}>
                                            {isCheckIn && <span className="text-[9px] bg-teal-500 text-white rounded px-0.5 mr-0.5">IN</span>}
                                            {isCheckOut && <span className="text-[9px] bg-teal-600 text-white rounded px-0.5 mr-0.5">OUT</span>}
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
                                        <div className="font-bold flex items-center justify-between mb-0.5 gap-0.5">
                                            <span className="truncate">{flight?.ticket?.airline || '未知航空公司'}</span>
                                            {flight.time && <span className="font-mono text-[9px] shrink-0">{flight.time}</span>}
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
