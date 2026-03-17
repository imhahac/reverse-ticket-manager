/**
 * Dashboard.jsx ── 頂部統計卡片列
 *
 * 純展示元件，接收數字 props 後渲染四格統計卡。
 * 不含任何業務邏輯或 state。
 *
 * Props:
 *   ticketCount   {number} 購入機票套數
 *   tripCount     {number} 配對出的趟次數
 *   totalPriceTWD {number} 入帳總計 (TWD)
 *   futureCostTWD {number} 未來待出行花費
 *   pastCostTWD   {number} 歷史已實現花費
 *   sunkCostTWD   {number} 未配對沉沒成本
 */
import React from 'react';
import { ListFilter, Plane } from 'lucide-react';

export default function Dashboard({
    ticketCount,
    tripCount,
    totalPriceTWD,
    futureCostTWD,
    pastCostTWD,
    sunkCostTWD,
}) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {/* 購入機票總數 */}
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-5 rounded-2xl shadow-lg text-white relative overflow-hidden">
                <div className="relative z-10">
                    <p className="text-indigo-100 font-medium mb-1 text-sm">購入機票總數</p>
                    <p className="text-3xl font-extrabold">{ticketCount} 套</p>
                </div>
                <ListFilter className="w-20 h-20 absolute -right-3 -bottom-3 text-white opacity-10" />
            </div>

            {/* 精算趟次 */}
            <div className="bg-gradient-to-br from-emerald-400 to-emerald-500 p-5 rounded-2xl shadow-lg text-white relative overflow-hidden">
                <div className="relative z-10">
                    <p className="text-emerald-50 font-medium mb-1 text-sm">精算趟次</p>
                    <p className="text-3xl font-extrabold">{tripCount} 趟</p>
                </div>
                <Plane className="w-20 h-20 absolute -right-3 -bottom-3 text-white opacity-10" />
            </div>

            {/* 入帳總計 + 三分類明細（跨 2 欄） */}
            <div className="col-span-2 bg-gradient-to-br from-slate-800 to-slate-900 p-5 rounded-2xl shadow-lg text-white relative overflow-hidden">
                <div className="relative z-10">
                    <p className="text-slate-300 font-medium mb-2 text-sm">🧾 入帳總計 (TWD)</p>
                    <p className="text-3xl font-extrabold mb-3">${totalPriceTWD.toLocaleString()}</p>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                        {/* 未來待出行 */}
                        <div className="bg-white/10 rounded-lg px-2 py-1.5">
                            <p className="text-slate-400 mb-0.5">🗓️ 未來待出行</p>
                            <p className="font-bold text-emerald-300">${futureCostTWD.toLocaleString()}</p>
                        </div>
                        {/* 歷史已實現 */}
                        <div className="bg-white/10 rounded-lg px-2 py-1.5">
                            <p className="text-slate-400 mb-0.5">✅ 歷史已實現</p>
                            <p className="font-bold text-slate-200">${pastCostTWD.toLocaleString()}</p>
                        </div>
                        {/* 未配對成本（橘色警示） */}
                        <div className={`rounded-lg px-2 py-1.5 ${sunkCostTWD > 0 ? 'bg-amber-500/20' : 'bg-white/10'}`}>
                            <p className={`mb-0.5 ${sunkCostTWD > 0 ? 'text-amber-300' : 'text-slate-400'}`}>⚠️ 未配對成本</p>
                            <p className={`font-bold ${sunkCostTWD > 0 ? 'text-amber-300' : 'text-slate-200'}`}>
                                ${sunkCostTWD.toLocaleString()}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="text-6xl font-black absolute -right-2 -bottom-6 text-white opacity-[0.03]">$</div>
            </div>
        </div>
    );
}
