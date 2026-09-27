/**
 * CostManager.jsx
 * 整合型財務中心：
 * 1. 💳 多幣別拆帳與結算：支援即時/凍結匯率、多人等額/自訂分攤、Settle-up 清帳撮合、CSV 匯出
 * 2. 📊 成本與 CP 值分析：機票/住宿/活動/雜支支出佔比圓餅圖、各趟行程日均花費柱狀圖、預算進度條
 * 3. 雙向資料打通：自動聚合全域票券憑證 (機票、飯店、活動) 與手動多幣別日常支出，拒絕空內容
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
    DollarSign, 
    Plus, 
    Download, 
    ArrowRight, 
    CheckCircle2, 
    Circle, 
    Trash2, 
    Users, 
    Lock, 
    RefreshCw, 
    Split, 
    PieChart as PieIcon,
    Wallet,
    CreditCard,
    LayoutDashboard,
    Calendar,
    Plane,
    Hotel,
    Ticket
} from 'lucide-react';
import { 
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { toast } from 'sonner';
import { useTrek } from '../../contexts/TrekContext';
import { useFilterContext } from '../../contexts/FilterContext';
import { useUIContext } from '../../contexts/UIContext';
import { useTicketDataContext } from '../../contexts/DataContext';
import { expenseRepo } from '../../services/db';
import { SUPPORTED_CURRENCIES, getExchangeRate, freezeExchangeRate } from '../../services/costs/currencyService';
import { splitEqual, calculateNetBalances } from '../../services/costs/splitCalculator';
import { calculateSettleUpTransactions } from '../../services/costs/settleUpService';
import { exportExpensesToCSV } from '../../services/costs/csvExportService';

export const EXPENSE_CATEGORIES = [
    { key: 'food', label: '餐飲美食', emoji: '🍽️' },
    { key: 'transport', label: '交通移動', emoji: '🚗' },
    { key: 'lodging', label: '住宿費用', emoji: '🏨' },
    { key: 'ticket', label: '門票體驗', emoji: '🎫' },
    { key: 'shopping', label: '購物紀念', emoji: '🛍️' },
    { key: 'other', label: '雜支其他', emoji: '📄' }
];

const COLORS = {
    flights: '#6366f1',
    hotels: '#14b8a6',
    activities: '#f97316',
    custom: '#8b5cf6',
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

export default function CostManager() {
    const { activeTrip } = useTrek();
    const { activeTab, setActiveTab } = useUIContext();
    const {
        safeTickets = [],
        safeHotels = [],
        safeActivities = [],
        totalPriceTWD = 0,
        totalHotelTWD = 0,
        totalActivityTWD = 0,
        totalPaidTWD = 0,
        totalPendingTWD = 0,
        filteredItinerary = []
    } = useFilterContext();
    const { tripBudgets } = useTicketDataContext();

    // 視圖模式：'split' (多幣別拆帳) | 'analytics' (成本與CP值分析) | 'all' (全景整合)
    const [subView, setSubView] = useState(() => {
        return activeTab === 'analytics' ? 'analytics' : 'split';
    });

    // 當外部 Workspace tab 切換時同步內部視圖
    useEffect(() => {
        if (activeTab === 'analytics') {
            setSubView('analytics');
        } else if (activeTab === 'costs') {
            setSubView('split');
        }
    }, [activeTab]);

    const [customExpenses, setCustomExpenses] = useState([]);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);

    // 新增支出表單狀態
    const [formTitle, setFormTitle] = useState('');
    const [formCategory, setFormCategory] = useState('food');
    const [formAmount, setFormAmount] = useState('');
    const [formCurrency, setFormCurrency] = useState('JPY');
    const [liveRate, setLiveRate] = useState(1);
    const [formPaidBy, setFormPaidBy] = useState('我');
    const [participantsText, setParticipantsText] = useState('我, 旅伴A, 旅伴B');

    // 1. 載入手動記帳支出
    const loadCustomExpenses = async () => {
        if (!activeTrip) return;
        const all = await expenseRepo.getByTrip(activeTrip.id);
        all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setCustomExpenses(all);
    };

    useEffect(() => {
        loadCustomExpenses();
    }, [activeTrip?.id]);

    // 2. 當幣別變動時，即時獲取 Frankfurter 預估匯率
    useEffect(() => {
        const base = activeTrip?.baseCurrency || 'TWD';
        getExchangeRate(formCurrency, base).then(r => setLiveRate(r));
    }, [formCurrency, activeTrip?.baseCurrency]);

    // 3. 核心：將全域機票、飯店、活動無縫聚合進支出與拆帳項目
    const unifiedExpenses = useMemo(() => {
        const list = [...customExpenses];
        const existingIds = new Set(list.map(e => e.id));

        // 整合機票
        (safeTickets || []).forEach(ticket => {
            const id = `ticket_${ticket.id}`;
            if (existingIds.has(id)) return;
            const amtTWD = ticket.priceTWD || ticket.price || 0;
            if (amtTWD <= 0) return;
            list.push({
                id,
                tripId: activeTrip?.id,
                title: `✈️ 機票: ${ticket.airline || ''} (${ticket.departRegion?.split(' ')[0] || ''} ⇄ ${ticket.returnRegion?.split(' ')[0] || ''})`,
                category: 'ticket',
                amount: ticket.price || amtTWD,
                currency: ticket.currency || 'TWD',
                rateToTripBase: ticket.exchangeRate || 1,
                baseCurrency: 'TWD',
                baseAmount: amtTWD,
                paidBy: '我',
                participants: ['我'],
                shares: { '我': amtTWD },
                settled: ticket.isPaid ?? true,
                sourceLabel: '機票管理',
                isSystemLinked: true,
                createdAt: ticket.outboundDate ? new Date(ticket.outboundDate).getTime() : Date.now()
            });
        });

        // 整合住宿
        (safeHotels || []).forEach(hotel => {
            const id = `hotel_${hotel.id}`;
            if (existingIds.has(id)) return;
            const amtTWD = hotel.priceTWD || hotel.priceTotal || 0;
            if (amtTWD <= 0) return;
            list.push({
                id,
                tripId: activeTrip?.id,
                title: `🏨 住宿: ${hotel.name || '飯店'} (${hotel.totalNights || 1}晚)`,
                category: 'lodging',
                amount: hotel.priceTotal || amtTWD,
                currency: hotel.currency || 'TWD',
                rateToTripBase: 1,
                baseCurrency: 'TWD',
                baseAmount: amtTWD,
                paidBy: '我',
                participants: ['我'],
                shares: { '我': amtTWD },
                settled: true,
                sourceLabel: '飯店管理',
                isSystemLinked: true,
                createdAt: hotel.checkIn ? new Date(hotel.checkIn).getTime() : Date.now()
            });
        });

        // 整合活動
        (safeActivities || []).forEach(act => {
            const id = `act_${act.id}`;
            if (existingIds.has(id)) return;
            const amtTWD = act.priceTWD || act.cost || 0;
            if (amtTWD <= 0) return;
            list.push({
                id,
                tripId: activeTrip?.id,
                title: `🎫 活動: ${act.title || '票券'}`,
                category: 'ticket',
                amount: act.price || amtTWD,
                currency: act.currency || 'TWD',
                rateToTripBase: 1,
                baseCurrency: 'TWD',
                baseAmount: amtTWD,
                paidBy: '我',
                participants: ['我'],
                shares: { '我': amtTWD },
                settled: true,
                sourceLabel: '票券憑證',
                isSystemLinked: true,
                createdAt: act.startDate ? new Date(act.startDate).getTime() : Date.now()
            });
        });

        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        return list;
    }, [customExpenses, safeTickets, safeHotels, safeActivities, activeTrip?.id]);

    // 4. 費用總計與預算計算
    const baseCurrency = activeTrip?.baseCurrency || 'TWD';
    const totalCustomSpentTWD = customExpenses.reduce((sum, e) => sum + (e.baseAmount || 0), 0);
    const totalSpentTWD = totalPriceTWD + totalHotelTWD + totalActivityTWD + totalCustomSpentTWD;
    const tripBudget = activeTrip?.budget || 0;
    const budgetRemaining = tripBudget > 0 ? tripBudget - totalSpentTWD : null;

    // 5. 智慧清帳撮合
    const netBalances = useMemo(() => calculateNetBalances(unifiedExpenses), [unifiedExpenses]);
    const settleTransactions = useMemo(() => calculateSettleUpTransactions(netBalances), [netBalances]);

    // 6. 圖表分析資料
    const pieData = useMemo(() => [
        { name: '✈️ 機票', value: totalPriceTWD, key: 'flights' },
        { name: '🏨 住宿', value: totalHotelTWD, key: 'hotels' },
        { name: '🎫 活動', value: totalActivityTWD, key: 'activities' },
        { name: '🛍️ 日常雜支', value: totalCustomSpentTWD, key: 'custom' },
    ].filter(d => d.value > 0), [totalPriceTWD, totalHotelTWD, totalActivityTWD, totalCustomSpentTWD]);

    const barData = useMemo(() => {
        return (filteredItinerary || [])
            .filter(t => t.tripDays > 0)
            .map((t, i) => ({
                name: t.tripDays ? `Trip ${i + 1}` : '',
                label: t.customLabel || `Trip ${i + 1}`,
                機票日均: t.costPerDay ?? 0,
                trip: t,
            }))
            .slice(0, 12);
    }, [filteredItinerary]);

    // ── 提交新增手動支出 ──────────────────────────────────────────────────
    const handleAddExpenseSubmit = async (e) => {
        e.preventDefault();
        const amt = parseFloat(formAmount);
        if (isNaN(amt) || amt <= 0) {
            toast.error('請輸入有效金額');
            return;
        }

        const participants = participantsText
            .split(/[,，\s]+/)
            .map(s => s.trim())
            .filter(Boolean);

        if (participants.length === 0) {
            toast.error('請至少指定一位分攤人員');
            return;
        }

        const frozen = await freezeExchangeRate(amt, formCurrency, baseCurrency);
        const shares = splitEqual(frozen.baseAmount, participants);

        const newExpense = {
            id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            tripId: activeTrip?.id,
            title: formTitle.trim() || '未命名支出',
            category: formCategory,
            amount: amt,
            currency: formCurrency,
            rateToTripBase: frozen.rateToTripBase,
            baseCurrency,
            baseAmount: frozen.baseAmount,
            frozenAt: frozen.frozenAt,
            paidBy: formPaidBy.trim() || '我',
            splitType: 'equal',
            participants,
            shares,
            settled: false,
            createdAt: Date.now()
        };

        await expenseRepo.save(newExpense);
        toast.success(`已記錄支出：${newExpense.title} (匯率已凍結: ${frozen.rateToTripBase})`);

        setFormTitle('');
        setFormAmount('');
        setIsAddModalOpen(false);
        await loadCustomExpenses();
    };

    // ── 標記結清切換 ──────────────────────────────────────────────────────
    const handleToggleSettled = async (exp) => {
        if (exp.isSystemLinked) {
            toast.info('此項目由全域票券管理自動同步，請至『票券憑證』修改付款狀態');
            return;
        }
        const updated = { ...exp, settled: !exp.settled };
        await expenseRepo.save(updated);
        await loadCustomExpenses();
        toast.info(updated.settled ? '已標記為結清' : '已恢復為未結清');
    };

    // ── 刪除支出 ──────────────────────────────────────────────────────────
    const handleDeleteExpense = async (exp) => {
        if (exp.isSystemLinked) {
            toast.info(`此項目由「${exp.sourceLabel}」自動同步，請至頂部『票券憑證』刪除`);
            return;
        }
        if (confirm(`確定要刪除支出「${exp.title}」嗎？`)) {
            await expenseRepo.delete(exp.id);
            await loadCustomExpenses();
            toast.info('支出已刪除');
        }
    };

    // ── 一鍵結清所有債務 ──────────────────────────────────────────────────
    const handleSettleAll = async () => {
        if (confirm('確定要將當前所有未結清支出標記為已結清嗎？')) {
            for (const exp of customExpenses) {
                if (!exp.settled) {
                    await expenseRepo.save({ ...exp, settled: true });
                }
            }
            await loadCustomExpenses();
            toast.success('🎉 所有帳目已完成結清！');
            setIsSettleModalOpen(false);
        }
    };

    const handleSwitchSubView = (mode) => {
        setSubView(mode);
        if (mode === 'analytics') {
            setActiveTab('analytics');
        } else if (mode === 'split') {
            setActiveTab('costs');
        }
    };

    return (
        <div className="space-y-6">
            {/* ── 頂部財務中心三合一視圖切換器 ───────────────────────────────── */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-gray-200 pb-3">
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                    <button
                        onClick={() => handleSwitchSubView('split')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                            subView === 'split' 
                                ? 'bg-white text-indigo-700 shadow-sm' 
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>💳 多幣別拆帳與結算 ({unifiedExpenses.length})</span>
                    </button>

                    <button
                        onClick={() => handleSwitchSubView('analytics')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                            subView === 'analytics' 
                                ? 'bg-white text-indigo-700 shadow-sm' 
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <PieIcon className="w-3.5 h-3.5" />
                        <span>📊 成本與 CP 值分析</span>
                    </button>

                    <button
                        onClick={() => handleSwitchSubView('all')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                            subView === 'all' 
                                ? 'bg-white text-indigo-700 shadow-sm' 
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <LayoutDashboard className="w-3.5 h-3.5" />
                        <span>📋 財務全景視圖</span>
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => exportExpensesToCSV(activeTrip?.title || '旅程費用', unifiedExpenses, settleTransactions)}
                        title="匯出 UTF-8 BOM CSV 財務清冊"
                        className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-gray-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                    >
                        <Download className="w-3.5 h-3.5 text-indigo-600" />
                        <span>匯出 CSV 報表</span>
                    </button>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center gap-1.5"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>記一筆支出</span>
                    </button>
                </div>
            </div>

            {/* ── 模組 A：成本與 CP 值分析儀表板 (在 analytics 或 all 模式顯示) ── */}
            {(subView === 'analytics' || subView === 'all') && (
                <div className="space-y-6">
                    {/* 5 大核心指標卡 */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
                        <div className="bg-gradient-to-tr from-indigo-900 via-indigo-950 to-slate-950 rounded-2xl p-4 text-white shadow-md">
                            <span className="text-xs text-indigo-300 font-bold uppercase tracking-wider">💰 旅費總計</span>
                            <div className="text-2xl font-black mt-1 font-mono">{NT(totalSpentTWD)}</div>
                            <p className="text-[11px] text-indigo-200/80 mt-1">已付: {NT(totalPaidTWD)}</p>
                        </div>

                        <div className={`rounded-2xl border p-4 shadow-sm ${totalPendingTWD > 0 ? 'bg-rose-50/80 border-rose-200' : 'bg-white border-slate-200/80'}`}>
                            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">⏳ 待付款項</span>
                            <div className={`text-2xl font-black mt-1 font-mono ${totalPendingTWD > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                                {NT(totalPendingTWD)}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1">{totalPendingTWD > 0 ? '需留意付款截止日' : '目前無待付款'}</p>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
                            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">✈️ 機票支出</span>
                            <div className="text-2xl font-black text-indigo-600 mt-1 font-mono">{NT(totalPriceTWD)}</div>
                            <p className="text-[11px] text-slate-400 mt-1">共 {safeTickets.length} 筆機票訂單</p>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
                            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">🏨 住宿支出</span>
                            <div className="text-2xl font-black text-teal-600 mt-1 font-mono">{NT(totalHotelTWD)}</div>
                            <p className="text-[11px] text-slate-400 mt-1">共 {safeHotels.length} 筆飯店住宿</p>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
                            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">🎫 活動與雜支</span>
                            <div className="text-2xl font-black text-orange-600 mt-1 font-mono">
                                {NT(totalActivityTWD + totalCustomSpentTWD)}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1">活動 {safeActivities.length} 項 · 雜支 {customExpenses.length} 筆</p>
                        </div>
                    </div>

                    {/* 圖表分析區：圓餅圖佔比 + 柱狀圖各趟日均支出 */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* 圓餅圖：支出佔比 */}
                        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
                            <h3 className="font-extrabold text-slate-700 mb-3 text-xs uppercase tracking-wider flex items-center gap-1.5">
                                <PieIcon className="w-4 h-4 text-indigo-600" /> 支出類別佔比
                            </h3>
                            {pieData.length === 0 ? (
                                <div className="h-[220px] flex items-center justify-center text-slate-400 text-xs">
                                    尚無足夠的費用資料產生圖表
                                </div>
                            ) : (
                                <>
                                    <ResponsiveContainer width="100%" height={210}>
                                        <PieChart>
                                            <Pie
                                                data={pieData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={50}
                                                outerRadius={80}
                                                paddingAngle={4}
                                                dataKey="value"
                                                nameKey="name"
                                            >
                                                {pieData.map((entry) => (
                                                    <Cell key={entry.key} fill={COLORS[entry.key] || '#94a3b8'} />
                                                ))}
                                            </Pie>
                                            <Tooltip content={<CustomTooltip />} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="flex flex-wrap justify-center gap-3.5 mt-2">
                                        {pieData.map(d => (
                                            <div key={d.key} className="flex items-center gap-1.5 text-xs">
                                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[d.key] || '#94a3b8' }}></span>
                                                <span className="text-slate-600 font-medium">{d.name}</span>
                                                <span className="font-bold font-mono text-slate-800">
                                                    {totalSpentTWD > 0 ? Math.round(d.value / totalSpentTWD * 100) : 0}%
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* 柱狀圖：每趟行程日均花費 */}
                        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
                            <h3 className="font-extrabold text-slate-700 mb-3 text-xs uppercase tracking-wider flex items-center gap-1.5">
                                <Calendar className="w-4 h-4 text-indigo-600" /> 各趟行程日均機票成本 (CP 值指標)
                            </h3>
                            {barData.length === 0 ? (
                                <div className="h-[220px] flex items-center justify-center text-slate-400 text-xs">
                                    尚無包含有效天數的行程配對資料
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height={240}>
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

                    {/* 行程費用明細與預算進度條 */}
                    {filteredItinerary.length > 0 && (
                        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm overflow-x-auto">
                            <h3 className="font-extrabold text-slate-700 mb-3 text-xs uppercase tracking-wider">
                                📋 行程預算達成率明細
                            </h3>
                            <table className="w-full text-xs min-w-[550px]">
                                <thead>
                                    <tr className="border-b border-slate-100 text-slate-400">
                                        <th className="text-left py-2 px-2 font-bold uppercase">行程標籤</th>
                                        <th className="text-right py-2 px-2 font-bold uppercase">天數</th>
                                        <th className="text-right py-2 px-2 font-bold uppercase">機票費</th>
                                        <th className="text-right py-2 px-2 font-bold uppercase">住宿費</th>
                                        <th className="text-right py-2 px-2 font-bold uppercase">合計金額</th>
                                        <th className="text-right py-2 px-2 font-bold uppercase">日均成本</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredItinerary.map((trip, i) => {
                                        const flightCost = trip.totalCostTWD ?? 0;
                                        const hotelCost = trip.totalHotelCostTWD ?? 0;
                                        const total = flightCost + hotelCost;
                                        const perDay = trip.tripDays > 0 ? Math.round(total / trip.tripDays) : null;
                                        const tBudget = tripBudgets?.[trip.id] || 0;
                                        const budgetPercent = tBudget > 0 ? Math.min(100, Math.round((total / tBudget) * 100)) : 0;
                                        const isOverBudget = budgetPercent >= 100;

                                        return (
                                            <React.Fragment key={trip.id ?? i}>
                                                <tr className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                                    <td className="py-2.5 px-2 font-bold text-slate-800">
                                                        {trip.customLabel || `Trip ${i + 1}`}
                                                        {trip.isPast && <span className="ml-2 text-[10px] bg-slate-100 text-slate-400 px-1.5 rounded font-normal">已完成</span>}
                                                    </td>
                                                    <td className="py-2.5 px-2 text-right text-slate-500">{trip.tripDays ?? '—'} 天</td>
                                                    <td className="py-2.5 px-2 text-right font-mono text-indigo-600 font-semibold">{NT(flightCost)}</td>
                                                    <td className="py-2.5 px-2 text-right font-mono text-teal-600 font-semibold">{NT(hotelCost)}</td>
                                                    <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-900">{NT(total)}</td>
                                                    <td className="py-2.5 px-2 text-right font-mono text-slate-500 font-semibold">{perDay ? NT(perDay) : '—'}</td>
                                                </tr>
                                                {tBudget > 0 && (
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
                                                                    {NT(total)} / {NT(tBudget)} ({budgetPercent}%)
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
            )}

            {/* ── 模組 B：多幣別拆帳與結算 (在 split 或 all 模式顯示) ── */}
            {(subView === 'split' || subView === 'all') && (
                <div className="space-y-6">
                    {/* 預算、總支出與清帳狀態概覽 */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-950 rounded-2xl p-5 text-white shadow-md">
                            <span className="text-xs text-indigo-300 font-bold uppercase tracking-wider">總累計支出 (含機票與訂單)</span>
                            <div className="text-2xl font-black mt-1 font-mono">
                                ${Math.round(totalSpentTWD).toLocaleString()}
                                <span className="text-sm font-normal text-indigo-300 ml-1.5">{baseCurrency}</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-2">共整合 {unifiedExpenses.length} 筆消費明細</p>
                        </div>

                        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
                            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">當前旅程總預算</span>
                            <div className="text-2xl font-black text-slate-800 mt-1 font-mono">
                                {tripBudget > 0 ? `$${tripBudget.toLocaleString()}` : '未設定'}
                                {tripBudget > 0 && <span className="text-sm font-normal text-slate-400 ml-1.5">{baseCurrency}</span>}
                            </div>
                            {budgetRemaining != null && (
                                <p className={`text-xs mt-2 font-bold ${budgetRemaining >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {budgetRemaining >= 0 ? `剩餘額度: $${budgetRemaining.toLocaleString()}` : `超出預算: $${Math.abs(budgetRemaining).toLocaleString()}`}
                                </p>
                            )}
                        </div>

                        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
                            <div>
                                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">旅伴拆帳撮合清帳</span>
                                <div className="text-sm font-bold text-slate-700 mt-1">
                                    {settleTransactions.length > 0 ? (
                                        <span className="text-amber-600">待結清還款 {settleTransactions.length} 筆</span>
                                    ) : (
                                        <span className="text-emerald-600">帳目已全部平衡結清</span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 pt-3">
                                <button
                                    onClick={() => setIsSettleModalOpen(true)}
                                    className="flex-1 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-lg transition text-center"
                                >
                                    查看還款建議 (Settle-up)
                                </button>
                                <button
                                    onClick={() => exportExpensesToCSV(activeTrip?.title || '費用清冊', unifiedExpenses, settleTransactions)}
                                    title="匯出 CSV 報表"
                                    className="p-1.5 border border-gray-200 hover:bg-slate-50 text-slate-600 rounded-lg transition"
                                >
                                    <Download className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 消費明細清單標題 */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                                <Wallet className="w-5 h-5 text-indigo-600" />
                                <span>消費與拆帳明細清單</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono">
                                    {unifiedExpenses.length} 筆
                                </span>
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                                已自動匯總全域機票、飯店住宿、活動票券與旅程多幣別日常雜支
                            </p>
                        </div>
                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition flex items-center gap-1.5"
                        >
                            <Plus className="w-4 h-4" />
                            <span>記一筆支出</span>
                        </button>
                    </div>

                    {/* 消費明細卡片列表 */}
                    <div className="space-y-2.5">
                        {unifiedExpenses.length === 0 ? (
                            <div className="bg-white rounded-2xl p-12 text-center text-slate-400 border border-gray-200 border-dashed">
                                <DollarSign className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                                <p className="text-sm font-semibold">此旅程尚無任何支出紀錄</p>
                                <p className="text-xs text-slate-400 mt-1">可點擊右上角「記一筆支出」，或至『票券憑證』新增機票、飯店與活動</p>
                            </div>
                        ) : (
                            unifiedExpenses.map(exp => {
                                const cat = EXPENSE_CATEGORIES.find(c => c.key === exp.category) || EXPENSE_CATEGORIES[0];
                                return (
                                    <div
                                        key={exp.id}
                                        className={`bg-white rounded-xl p-4 border transition-all shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                                            exp.settled ? 'opacity-70 border-gray-100 bg-slate-50/50' : 'border-slate-200/80 hover:border-indigo-300'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3.5 flex-1 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-lg shrink-0">
                                                {exp.isSystemLinked ? (
                                                    exp.category === 'lodging' ? '🏨' : exp.category === 'ticket' && exp.title.includes('機票') ? '✈️' : '🎫'
                                                ) : (
                                                    cat.emoji
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-bold text-sm text-slate-800 truncate">{exp.title}</span>
                                                    {exp.sourceLabel && (
                                                        <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.5 rounded border border-indigo-200/60">
                                                            🔗 {exp.sourceLabel}
                                                        </span>
                                                    )}
                                                    {exp.settled ? (
                                                        <span className="text-[10px] bg-slate-200 text-slate-600 font-bold px-1.5 py-0.5 rounded">已結清</span>
                                                    ) : (
                                                        <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded">未結清</span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                                                    <span>由 <strong>{exp.paidBy}</strong> 先付</span>
                                                    <span>·</span>
                                                    <span>分攤人: {exp.participants?.join(', ') || '全員'}</span>
                                                    {exp.currency !== baseCurrency && (
                                                        <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.2 rounded font-mono">
                                                            匯率 {exp.rateToTripBase} 已凍結
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0">
                                            <div className="text-left sm:text-right">
                                                <div className="font-bold text-base text-slate-900 font-mono">
                                                    ${Math.round(exp.baseAmount).toLocaleString()}
                                                    <span className="text-xs font-normal text-slate-400 ml-1">{baseCurrency}</span>
                                                </div>
                                                {exp.currency !== baseCurrency && (
                                                    <div className="text-[11px] text-slate-400 font-mono">
                                                        {exp.currency} {exp.amount?.toLocaleString()}
                                                    </div>
                                                )}
                                            </div>

                                            <button
                                                onClick={() => handleToggleSettled(exp)}
                                                title={exp.settled ? '標記為未結清' : '標記為已結清'}
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 transition"
                                            >
                                                {exp.settled ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Circle className="w-4 h-4" />}
                                            </button>

                                            <button
                                                onClick={() => handleDeleteExpense(exp)}
                                                title={exp.isSystemLinked ? '全域票券管理項目提示' : '刪除支出'}
                                                className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* ── Modal 1: 記錄新支出 ────────────────────────────────────────── */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-800 animate-in fade-in zoom-in-95 duration-150">
                        <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                            <Plus className="w-5 h-5 text-indigo-600" /> 記錄新支出 (支援外幣與凍結匯率)
                        </h3>
                        <form onSubmit={handleAddExpenseSubmit} className="space-y-3.5">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">消費項目</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="例如：居酒屋晚餐、晴空塔門票、計程車"
                                    value={formTitle}
                                    onChange={(e) => setFormTitle(e.target.value)}
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">分類</label>
                                    <select
                                        value={formCategory}
                                        onChange={(e) => setFormCategory(e.target.value)}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                                    >
                                        {EXPENSE_CATEGORIES.map(c => (
                                            <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">付款人</label>
                                    <input
                                        type="text"
                                        required
                                        value={formPaidBy}
                                        onChange={(e) => setFormPaidBy(e.target.value)}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">金額</label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        placeholder="0.00"
                                        value={formAmount}
                                        onChange={(e) => setFormAmount(e.target.value)}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">幣別</label>
                                    <select
                                        value={formCurrency}
                                        onChange={(e) => setFormCurrency(e.target.value)}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                                    >
                                        {SUPPORTED_CURRENCIES.map(curr => (
                                            <option key={curr} value={curr}>{curr}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {formCurrency !== baseCurrency && (
                                <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-800 flex items-center justify-between">
                                    <span>
                                        即時預估匯率: 1 {formCurrency} ≈ {liveRate} {baseCurrency}
                                    </span>
                                    <span className="font-mono font-bold">
                                        ≈ ${Math.round((parseFloat(formAmount) || 0) * liveRate).toLocaleString()} {baseCurrency}
                                    </span>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">
                                    分攤人員 (以逗號分隔，採用最大餘數法平分)
                                </label>
                                <input
                                    type="text"
                                    value={participantsText}
                                    onChange={(e) => setParticipantsText(e.target.value)}
                                    placeholder="我, 旅伴A, 旅伴B"
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div className="flex gap-2 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition"
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition"
                                >
                                    確定儲存並鎖定匯率
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Modal 2: Settle-up 還款結算方案 ────────────────────────────── */}
            {isSettleModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl text-slate-800 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-base flex items-center gap-2">
                                <Split className="w-5 h-5 text-indigo-600" />
                                <span>旅伴清帳與還款建議方案</span>
                            </h3>
                            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold">
                                債務路徑最小化演算法
                            </span>
                        </div>

                        {settleTransactions.length === 0 ? (
                            <div className="p-8 text-center text-slate-400">
                                <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-emerald-500" />
                                <p className="text-sm font-semibold text-slate-700">太棒了！目前無任何待清償債務</p>
                                <p className="text-xs text-slate-400 mt-1">所有旅伴的預付與分攤金額已完全平衡</p>
                            </div>
                        ) : (
                            <div className="space-y-3 my-4 max-h-[60vh] overflow-y-auto">
                                <p className="text-xs text-slate-500">
                                    依據所有人預付與應付額度，以下為最簡轉帳路徑（共需 {settleTransactions.length} 筆轉帳）：
                                </p>
                                {settleTransactions.map((tx, idx) => (
                                    <div
                                        key={idx}
                                        className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-2 text-xs font-bold">
                                            <span className="text-rose-600 bg-rose-50 px-2 py-1 rounded">{tx.from}</span>
                                            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                                            <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded">{tx.to}</span>
                                        </div>
                                        <div className="font-black text-sm text-slate-900 font-mono">
                                            ${tx.amount.toLocaleString()} <span className="text-xs font-normal text-slate-400">{baseCurrency}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex gap-2 pt-3 border-t border-gray-100">
                            <button
                                onClick={() => setIsSettleModalOpen(false)}
                                className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition"
                            >
                                關閉
                            </button>
                            {settleTransactions.length > 0 && (
                                <button
                                    onClick={handleSettleAll}
                                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-1.5"
                                >
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>一鍵標記全部結清</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
