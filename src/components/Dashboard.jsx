/**
 * Dashboard.jsx ── 頂部統計卡片列
 *
 * 純展示元件，接收數字 props。
 *
 * Props:
 *   ticketCount      {number} 購入機票套數
 *   tripCount        {number} 配對出的趟次數
 *   hotelCount       {number} 住宿筆數
 *   totalPriceTWD    {number} 機票入帳總計 (TWD)
 *   totalHotelTWD    {number} 住宿總計 (TWD)
 *   futureCostTWD    {number} 未來待出行花費（機票）
 *   pastCostTWD      {number} 歷史已實現花費（機票）
 *   sunkCostTWD      {number} 未配對沉沒成本
 */
import React from 'react';
// import PropTypes from 'prop-types';
import { ListFilter, Plane, Building2 } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';

export default function Dashboard() {
    const {
        safeTickets = [], trips = [], safeHotels = [], safeActivities = [],
        totalPriceTWD = 0, totalHotelTWD = 0, totalActivityTWD = 0,
        futureCostTWD = 0, pastCostTWD = 0, sunkCostTWD = 0, totalTripDays = 0,
    } = useAppContext();

    const ticketCount = safeTickets.length;
    const tripCount = trips.length;
    const hotelCount = safeHotels.length;
    const activityCount = safeActivities.length;
    const grandTotal = totalPriceTWD + totalHotelTWD + totalActivityTWD;
    const flightRatio = grandTotal > 0 ? (totalPriceTWD / grandTotal) * 100 : 0;
    const hotelRatio = grandTotal > 0 ? (totalHotelTWD / grandTotal) * 100 : 0;
    const activityRatio = grandTotal > 0 ? (totalActivityTWD / grandTotal) * 100 : 0;

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {/* 購入機票總數 */}
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-5 rounded-2xl shadow-lg text-white relative overflow-hidden group">
                <div className="relative z-10">
                    <p className="text-indigo-100 font-medium mb-1 text-sm">購入機票總數</p>
                    <p className="text-3xl font-extrabold">{ticketCount} 套</p>
                    <p className="text-[10px] text-indigo-200 mt-2 opacity-80 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        <Plane className="w-3 h-3" /> 各項反向/單程機票總計
                    </p>
                </div>
                <ListFilter className="w-20 h-20 absolute -right-3 -bottom-3 text-white opacity-10 group-hover:scale-110 transition-transform" />
            </div>

            {/* 精算趟次 + 住宿筆數 */}
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-5 rounded-2xl shadow-lg text-white relative overflow-hidden group">
                <div className="relative z-10">
                    <p className="text-emerald-50 font-medium mb-1 text-sm">精算行程總額</p>
                    <p className="text-3xl font-extrabold">{tripCount} 趟</p>
                    <div className="text-[10px] text-emerald-100 mt-2 flex items-center gap-3">
                        {hotelCount > 0 && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {hotelCount} 筆住宿</span>}
                        {activityCount > 0 && <span className="flex items-center gap-1">🎫 {activityCount} 項活動</span>}
                        {totalTripDays > 0 && <span className="flex items-center gap-1">🗓️ 共 {totalTripDays} 天</span>}
                    </div>
                </div>
                <Plane className="w-20 h-20 absolute -right-3 -bottom-3 text-white opacity-10 group-hover:scale-110 transition-transform" />
            </div>

            {/* 預算深度分析卡片 (占兩格) */}
            <div className="col-span-2 bg-gradient-to-br from-slate-800 to-slate-900 p-5 rounded-2xl shadow-lg text-white relative overflow-hidden group">
                <div className="relative z-10">
                    <div className="flex items-baseline justify-between mb-2">
                        <p className="text-slate-300 font-medium text-sm">📊 旅費預算分析 (TWD)</p>
                        <p className="text-[10px] text-slate-400 font-bold bg-white/10 px-2 py-0.5 rounded-full">
                            日均：${totalTripDays > 0 ? Math.round(grandTotal / totalTripDays).toLocaleString() : 0} / 天
                        </p>
                    </div>
                    
                    <div className="flex items-end gap-2 mb-4">
                        <p className="text-3xl font-extrabold">${grandTotal.toLocaleString()}</p>
                        <span className="text-xs text-slate-400 mb-1">機票 + 住宿</span>
                    </div>

                    {/* 預算佔比條 */}
                    <div className="mb-4">
                        <div className="flex justify-between text-[10px] mb-1.5 font-bold">
                            <span className="text-indigo-300">✈️ 機票 ({Math.round(flightRatio)}%)</span>
                            <span className="text-teal-300">🏨 住宿 ({Math.round(hotelRatio)}%)</span>
                            <span className="text-orange-300">🎫 活動 ({Math.round(activityRatio)}%)</span>
                        </div>
                        <div className="h-2.5 w-full bg-slate-700 rounded-full overflow-hidden flex shadow-inner">
                            <div 
                                className="h-full bg-indigo-500 transition-all duration-1000 shadow-[0_0_10px_rgba(99,102,241,0.5)]" 
                                style={{ width: `${flightRatio}%` }}
                            ></div>
                            <div 
                                className="h-full bg-teal-400 transition-all duration-1000 shadow-[0_0_10px_rgba(45,212,191,0.5)]" 
                                style={{ width: `${hotelRatio}%` }}
                            ></div>
                            <div 
                                className="h-full bg-orange-400 transition-all duration-1000 shadow-[0_0_10px_rgba(251,146,60,0.5)]" 
                                style={{ width: `${activityRatio}%` }}
                            ></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                        <div className="bg-white/5 border border-white/5 rounded-xl px-2 py-2 group-hover:bg-white/10 transition-colors">
                            <p className="text-slate-400 mb-0.5 flex items-center gap-1">🗓️ 待出行</p>
                            <p className="font-bold text-emerald-400 text-xs">${futureCostTWD.toLocaleString()}</p>
                        </div>
                        <div className="bg-white/5 border border-white/5 rounded-xl px-2 py-2 group-hover:bg-white/10 transition-colors">
                            <p className="text-slate-400 mb-0.5 flex items-center gap-1">✅ 已完成</p>
                            <p className="font-bold text-slate-200 text-xs">${pastCostTWD.toLocaleString()}</p>
                        </div>
                        <div className={`rounded-xl px-2 py-2 border transition-colors ${sunkCostTWD > 0 ? 'bg-amber-500/10 border-amber-500/20 group-hover:bg-amber-500/20' : 'bg-white/5 border-white/5 group-hover:bg-white/10'}`}>
                            <p className={`mb-0.5 flex items-center gap-1 ${sunkCostTWD > 0 ? 'text-amber-300' : 'text-slate-400'}`}>
                                ⚠️ 沉沒成本
                            </p>
                            <p className={`font-bold text-xs ${sunkCostTWD > 0 ? 'text-amber-300' : 'text-slate-200'}`}>
                                ${sunkCostTWD.toLocaleString()}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="text-7xl font-black absolute -right-2 -bottom-8 text-white opacity-[0.03] select-none select-none group-hover:opacity-[0.05] transition-opacity font-mono">$</div>
            </div>
        </div>
    );
}

