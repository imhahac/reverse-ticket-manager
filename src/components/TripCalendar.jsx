import React, { useState } from 'react';
import { ArrowRight, PlaneTakeoff, PlaneLanding } from 'lucide-react';

export default function TripCalendar({ segments }) {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const getDaysInMonth = (year, month) => {
        return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (year, month) => {
        return new Date(year, month, 1).getDay();
    };

    const prevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const days = [];
    for (let i = 0; i < firstDay; i++) {
        days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
        days.push(i);
    }

    const isToday = (day) => {
        const today = new Date();
        return day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    };

    const getFlightsForDay = (day) => {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return segments.filter(seg => seg.date === dateStr);
    };

    const monthNames = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];
    const dayNames = ["日", "一", "二", "三", "四", "五", "六"];

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between p-4 bg-slate-50 border-b border-slate-100">
                <button onClick={prevMonth} className="px-4 py-2 hover:bg-slate-200 rounded text-slate-600 font-bold transition">◀ 上個月</button>
                <h3 className="text-xl font-black text-slate-800">{year}年 {monthNames[month]}</h3>
                <button onClick={nextMonth} className="px-4 py-2 hover:bg-slate-200 rounded text-slate-600 font-bold transition">下個月 ▶</button>
            </div>
            
            <div className="grid grid-cols-7 gap-px bg-slate-200">
                {dayNames.map(day => (
                    <div key={day} className="bg-slate-50 p-2 text-center text-xs font-bold text-slate-500">{day}</div>
                ))}
            </div>
            
            <div className="grid grid-cols-7 gap-px bg-slate-200">
                {days.map((day, idx) => {
                    if (!day) return <div key={`empty-${idx}`} className="bg-slate-50/50 min-h-[120px]"></div>;
                    
                    const flights = getFlightsForDay(day);
                    const isFocus = isToday(day);
                    
                    return (
                        <div key={day} className={`min-h-[120px] p-2 transition-colors ${isFocus ? 'bg-indigo-50' : 'bg-white hover:bg-slate-50'}`}>
                            <div className="flex justify-between items-start mb-2">
                                <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold ${isFocus ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}>
                                    {day}
                                </span>
                                {flights.length > 0 && <span className="text-[10px] font-bold text-indigo-500 bg-indigo-100 px-1.5 rounded">{flights.length}</span>}
                            </div>
                            
                            <div className="flex flex-col gap-1.5 mt-1">
                                {flights.map((flight, i) => {
                                    return (
                                        <div key={i} className={`p-1.5 rounded-md border text-xs shadow-sm ${flight.ticket.type === 'normal' ? 'bg-indigo-50 border-indigo-200 text-indigo-800' : flight.ticket.type === 'reverse' ? 'bg-purple-50 border-purple-200 text-purple-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                                            <div className="font-bold flex flex-wrap items-center justify-between mb-0.5 opacity-80 gap-1">
                                                <span>{flight.ticket.airline} {flight.flightNo && <span className="font-mono text-[9px] bg-white/50 px-1 rounded">{flight.flightNo}</span>}</span>
                                                {flight.time && <span className="font-mono">{flight.time}</span>}
                                            </div>
                                            <div className="flex items-center gap-1 font-bold">
                                                <span className="truncate">{flight.from.split(' ')[0]}</span>
                                                <ArrowRight className="w-3 h-3 shrink-0 opacity-50" />
                                                <span className="truncate">{flight.to.split(' ')[0]}</span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
