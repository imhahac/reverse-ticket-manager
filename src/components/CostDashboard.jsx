/**
 * CostDashboard.jsx ── 旅費成本分析儀表板
 *
 * 使用 recharts 呈現：
 *   - 圓餅圖：機票 / 住宿 / 活動佔比
 *   - 柱狀圖：每趟行程的日均花費
 */
import React, { useMemo } from 'react';
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import { useFilterContext } from '../contexts/FilterContext';
import { useTicketDataContext } from '../contexts/DataContext';

const COLORS = {
    flights: '#6366f1',
    hotels: '#14b8a6',
    activities: '#f97316',
};

const NT = (n) => `NT$${Math.round(n ?? 0).toLocaleString()}`;

const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs shadow-lg">
            <p className="font-bold text-slate-700">{payload[0].name}</p>
            <p className="text-indigo-600 font-mono">{NT(payload[0].value)}</p>
        </div>
    );
};

export default function CostDashboard() {
    const {
        totalPriceTWD = 0, totalHotelTWD = 0, totalActivityTWD = 0,
        totalPaidTWD = 0, totalPendingTWD = 0,
        filteredItinerary = [], safeTickets = [], safeHotels = [], safeActivities = [],
        trips = []
    } = useFilterContext();

    const { tripBudgets } = useTicketDataContext();

    const grandTotal = totalPriceTWD + totalHotelTWD + totalActivityTWD;

    const pieData = useMemo(() => [
        { name: '✈️ 機票', value: totalPriceTWD, key: 'flights' },
        { name: '🏨 住宿', value: totalHotelTWD, key: 'hotels' },
        { name: '🎫 活動', value: totalActivityTWD, key: 'activities' },
    ].filter(d => d.value > 0), [totalPriceTWD, totalHotelTWD, totalActivityTWD]);

    // 每趟行程的日均支出柱狀圖
    const barData = useMemo(() => {
        return (filteredItinerary || [])
            .filter(t => t.tripDays > 0)
            .map((t, i) => ({
                name: t.tripDays ? `Trip ${i + 1}` : '',
                label: t.customLabel || `Trip ${i + 1}`,
                機票日均: t.costPerDay ?? 0,
                trip: t,
            }))
            .slice(0, 12); // 最多顯示 12 趟
    }, [filteredItinerary]);

    if (grandTotal === 0) {
        return (
            <div className="p-12 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                <p className="text-4xl mb-3">📊</p>
                <p className="font-bold text-slate-500">尚無支出資料</p>
                <p className="text-sm mt-1">新增機票、住宿或活動後，將在此顯示完整的費用分析。</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* 頂部總覽卡 */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                    { label: '💰 旅費總計', value: NT(grandTotal), sub: `已付: ${NT(totalPaidTWD)}`, color: 'indigo' },
                    { label: '⏳ 待付款項', value: NT(totalPendingTWD), sub: '即將到來', color: 'rose' },
                    { label: '✈️ 機票支出', value: NT(totalPriceTWD), sub: `${trips.length} 趟行程`, color: 'indigo' },
                    { label: '🏨 住宿支出', value: NT(totalHotelTWD), sub: `${safeHotels.length} 筆住宿`, color: 'teal' },
                    { label: '🎫 活動支出', value: NT(totalActivityTWD), sub: `${safeActivities.length} 項活動`, color: 'orange' },
                ].map(card => (
                    <div key={card.label} className={`bg-white rounded-2xl border border-slate-100 p-4 shadow-sm ${card.label.includes('待付款項') && totalPendingTWD > 0 ? 'bg-rose-50 border-rose-200' : ''}`}>
                        <p className="text-xs text-slate-500 font-bold mb-1">{card.label}</p>
                        <p className={`text-2xl font-extrabold font-mono ${card.label.includes('待付款項') && totalPendingTWD > 0 ? 'text-rose-600' : 'text-slate-800'}`}>{card.value}</p>
                        <p className="text-xs text-slate-400 mt-1">{card.sub}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 圓餅圖：支出佔比 */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                    <h3 className="font-extrabold text-slate-700 mb-4 text-sm uppercase tracking-wider">📊 支出佔比</h3>
                    <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={55}
                                outerRadius={85}
                                paddingAngle={3}
                                dataKey="value"
                                nameKey="name"
                            >
                                {pieData.map((entry) => (
                                    <Cell key={entry.key} fill={COLORS[entry.key]} />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap justify-center gap-4 mt-2">
                        {pieData.map(d => (
                            <div key={d.key} className="flex items-center gap-1.5 text-xs">
                                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[d.key] }}></span>
                                <span className="text-slate-600 font-medium">{d.name}</span>
                                <span className="font-bold font-mono text-slate-800">{grandTotal > 0 ? Math.round(d.value / grandTotal * 100) : 0}%</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 柱狀圖：每趟行程日均花費 */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                    <h3 className="font-extrabold text-slate-700 mb-4 text-sm uppercase tracking-wider">🗓️ 各趟行程日均機票費</h3>
                    {barData.length === 0 ? (
                        <div className="flex items-center justify-center h-[220px] text-slate-400 text-sm">
                            尚無含天數的行程配對資料
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={barData} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                                <Tooltip
                                    formatter={(value, _, props) => [NT(value), `${props.payload.label} 日均`]}
                                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                                />
                                <Bar dataKey="機票日均" fill={COLORS.flights} radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* 行程費用明細表 */}
            {filteredItinerary.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm overflow-x-auto">
                    <h3 className="font-extrabold text-slate-700 mb-4 text-sm uppercase tracking-wider">📋 行程費用明細</h3>
                    <table className="w-full text-sm min-w-[500px]">
                        <thead>
                            <tr className="border-b border-slate-100">
                                <th className="text-left py-2 px-2 text-xs font-bold text-slate-400 uppercase">行程</th>
                                <th className="text-right py-2 px-2 text-xs font-bold text-slate-400 uppercase">天數</th>
                                <th className="text-right py-2 px-2 text-xs font-bold text-slate-400 uppercase">機票費</th>
                                <th className="text-right py-2 px-2 text-xs font-bold text-slate-400 uppercase">住宿費</th>
                                <th className="text-right py-2 px-2 text-xs font-bold text-slate-400 uppercase">合計</th>
                                <th className="text-right py-2 px-2 text-xs font-bold text-slate-400 uppercase">日均</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredItinerary.map((trip, i) => {
                                const flightCost = trip.totalCostTWD ?? 0;
                                const hotelCost = trip.totalHotelCostTWD ?? 0;
                                const total = flightCost + hotelCost;
                                const perDay = trip.tripDays > 0 ? Math.round(total / trip.tripDays) : null;
                                const tripBudget = tripBudgets?.[trip.id] || 0;
                                const budgetPercent = tripBudget > 0 ? Math.min(100, Math.round((total / tripBudget) * 100)) : 0;
                                const isOverBudget = budgetPercent >= 100;

                                return (
                                    <React.Fragment key={trip.id ?? i}>
                                        <tr className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                            <td className="py-2.5 px-2 font-medium text-slate-700">
                                                {trip.customLabel || `Trip ${i + 1}`}
                                                {trip.isPast && <span className="ml-2 text-[10px] bg-slate-100 text-slate-400 px-1.5 rounded">已過</span>}
                                            </td>
                                            <td className="py-2.5 px-2 text-right text-slate-500">{trip.tripDays ?? '—'} 天</td>
                                            <td className="py-2.5 px-2 text-right font-mono text-indigo-600">{NT(flightCost)}</td>
                                            <td className="py-2.5 px-2 text-right font-mono text-teal-600">{NT(hotelCost)}</td>
                                            <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-800">{NT(total)}</td>
                                            <td className="py-2.5 px-2 text-right font-mono text-slate-500">{perDay ? NT(perDay) : '—'}</td>
                                        </tr>
                                        {tripBudget > 0 && (
                                            <tr className="border-b border-slate-100 bg-slate-50/30">
                                                <td colSpan="6" className="py-2 px-3">
                                                    <div className="flex items-center gap-3 text-xs">
                                                        <span className="text-slate-500 font-bold w-12">預算</span>
                                                        <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                                                            <div 
                                                                className={`h-2 rounded-full ${isOverBudget ? 'bg-red-500' : budgetPercent > 80 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                                                                style={{ width: `${budgetPercent}%` }}
                                                            ></div>
                                                        </div>
                                                        <span className={`font-mono font-bold ${isOverBudget ? 'text-red-500' : 'text-slate-600'}`}>
                                                            {NT(total)} / {NT(tripBudget)} ({budgetPercent}%)
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
