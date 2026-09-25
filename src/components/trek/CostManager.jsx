/**
 * CostManager.jsx
 * 多幣別記帳、分攤與智慧清帳中心：
 * - 支援多幣別即時換算與 Frankfurter 匯率凍結 (Frozen Rate)
 * - 支援多人多付款人等額/自訂分攤 (最大餘數分錢法)
 * - 支援 Settle-up 債務最小化撮合清帳方案
 * - 支援 UTF-8 BOM CSV 報表一鍵匯出
 */

import React, { useState, useEffect } from 'react';
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
    Wallet
} from 'lucide-react';
import { toast } from 'sonner';
import { useTrek } from '../../contexts/TrekContext';
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

export default function CostManager() {
    const { activeTrip } = useTrek();
    const [expenses, setExpenses] = useState([]);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);

    // 新增支出表單
    const [formTitle, setFormTitle] = useState('');
    const [formCategory, setFormCategory] = useState('food');
    const [formAmount, setFormAmount] = useState('');
    const [formCurrency, setFormCurrency] = useState('JPY');
    const [liveRate, setLiveRate] = useState(1);
    const [formPaidBy, setFormPaidBy] = useState('我');
    const [participantsText, setParticipantsText] = useState('我, 旅伴A, 旅伴B');

    // 1. 載入當前旅程支出
    const loadExpenses = async () => {
        if (!activeTrip) return;
        const all = await expenseRepo.getByTrip(activeTrip.id);
        all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setExpenses(all);
    };

    useEffect(() => {
        loadExpenses();
    }, [activeTrip?.id]);

    // 2. 當幣別變動時，即時獲取 Frankfurter 預估匯率
    useEffect(() => {
        const base = activeTrip?.baseCurrency || 'TWD';
        getExchangeRate(formCurrency, base).then(r => setLiveRate(r));
    }, [formCurrency, activeTrip?.baseCurrency]);

    // 3. 計算總花費與結餘
    const baseCurrency = activeTrip?.baseCurrency || 'TWD';
    const totalSpentTWD = expenses.reduce((sum, e) => sum + (e.baseAmount || 0), 0);
    const tripBudget = activeTrip?.budget || 0;
    const budgetRemaining = tripBudget > 0 ? tripBudget - totalSpentTWD : null;

    // 4. 計算債務清帳
    const netBalances = calculateNetBalances(expenses);
    const settleTransactions = calculateSettleUpTransactions(netBalances);

    // ── 提交新增支出 ──────────────────────────────────────────────────────
    const handleAddExpenseSubmit = async (e) => {
        e.preventDefault();
        const amt = parseFloat(formAmount);
        if (isNaN(amt) || amt <= 0) {
            toast.error('請輸入有效金額');
            return;
        }

        // 解析參與分攤人員
        const participants = participantsText
            .split(/[,，\s]+/)
            .map(s => s.trim())
            .filter(Boolean);

        if (participants.length === 0) {
            toast.error('請至少指定一位分攤人員');
            return;
        }

        // 凍結匯率與換算 TWD 金額
        const frozen = await freezeExchangeRate(amt, formCurrency, baseCurrency);

        // 採用最大餘數法平分
        const shares = splitEqual(frozen.baseAmount, participants);

        const newExpense = {
            id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            tripId: activeTrip.id,
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
        await loadExpenses();
    };

    // ── 標記結清切換 ──────────────────────────────────────────────────────
    const handleToggleSettled = async (exp) => {
        const updated = { ...exp, settled: !exp.settled };
        await expenseRepo.save(updated);
        await loadExpenses();
        toast.info(updated.settled ? '已標記為結清' : '已恢復為未結清');
    };

    // ── 刪除支出 ──────────────────────────────────────────────────────────
    const handleDeleteExpense = async (id) => {
        if (confirm('確定要刪除這筆支出嗎？')) {
            await expenseRepo.delete(id);
            await loadExpenses();
            toast.info('支出已刪除');
        }
    };

    // ── 一鍵結清所有債務 ──────────────────────────────────────────────────
    const handleSettleAll = async () => {
        if (confirm('確定要將當前所有未結清支出標記為已結清嗎？')) {
            for (const exp of expenses) {
                if (!exp.settled) {
                    await expenseRepo.save({ ...exp, settled: true });
                }
            }
            await loadExpenses();
            toast.success('🎉 所有帳目已完成結清！');
            setIsSettleModalOpen(false);
        }
    };

    return (
        <div className="space-y-5">
            {/* 1. 頂部預算與開銷儀表板卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-tr from-slate-900 to-indigo-950 rounded-2xl p-5 text-white shadow-md">
                    <span className="text-xs text-indigo-300 font-bold uppercase tracking-wider">總累計支出</span>
                    <div className="text-2xl font-black mt-1">
                        ${Math.round(totalSpentTWD).toLocaleString()}
                        <span className="text-sm font-normal text-indigo-300 ml-1.5">{baseCurrency}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">共記錄 {expenses.length} 筆消費明細</p>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">旅程預算</span>
                    <div className="text-2xl font-black text-slate-800 mt-1">
                        {tripBudget > 0 ? `$${tripBudget.toLocaleString()}` : '未設定'}
                        {tripBudget > 0 && <span className="text-sm font-normal text-slate-400 ml-1.5">{baseCurrency}</span>}
                    </div>
                    {budgetRemaining != null && (
                        <p className={`text-xs mt-2 font-bold ${budgetRemaining >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {budgetRemaining >= 0 ? `剩餘額度: $${budgetRemaining.toLocaleString()}` : `超出預算: $${Math.abs(budgetRemaining).toLocaleString()}`}
                        </p>
                    )}
                </div>

                <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex flex-col justify-between">
                    <div>
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">清帳狀態</span>
                        <div className="text-sm font-bold text-slate-700 mt-1">
                            {settleTransactions.length > 0 ? (
                                <span className="text-amber-600">待結清還款 {settleTransactions.length} 筆</span>
                            ) : (
                                <span className="text-emerald-600">帳目已全部結清</span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 pt-3">
                        <button
                            onClick={() => setIsSettleModalOpen(true)}
                            className="flex-1 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-lg transition text-center"
                        >
                            查看還款建議
                        </button>
                        <button
                            onClick={() => exportExpensesToCSV(activeTrip.title, expenses, settleTransactions)}
                            title="匯出 CSV 報表"
                            className="p-1.5 border border-gray-200 hover:bg-slate-50 text-slate-600 rounded-lg transition"
                        >
                            <Download className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. 操作工具列 */}
            <div className="flex items-center justify-between">
                <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-indigo-600" /> 消費明細清單
                </h3>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition flex items-center gap-1.5"
                >
                    <Plus className="w-4 h-4" />
                    <span>新增支出</span>
                </button>
            </div>

            {/* 3. 支出清單項目卡片 */}
            <div className="space-y-2.5">
                {expenses.length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 text-center text-slate-400 border border-gray-200 border-dashed">
                        <DollarSign className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                        <p className="text-sm font-semibold">此旅程尚無任何支出紀錄</p>
                        <p className="text-xs text-slate-400 mt-1">點擊上方「新增支出」記錄外幣消費並鎖定匯率</p>
                    </div>
                ) : (
                    expenses.map(exp => {
                        const cat = EXPENSE_CATEGORIES.find(c => c.key === exp.category) || EXPENSE_CATEGORIES[0];
                        return (
                            <div
                                key={exp.id}
                                className={`bg-white rounded-xl p-4 border transition-all shadow-sm flex items-center justify-between gap-4 ${
                                    exp.settled ? 'opacity-60 border-gray-100 bg-slate-50/50' : 'border-gray-200 hover:border-indigo-300'
                                }`}
                            >
                                <div className="flex items-center gap-3.5 flex-1 min-w-0">
                                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-lg shrink-0">
                                        {cat.emoji}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-sm text-slate-800 truncate">{exp.title}</span>
                                            {exp.settled && (
                                                <span className="text-[10px] bg-slate-200 text-slate-600 font-bold px-1.5 py-0.5 rounded">已結清</span>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
                                            <span>由 <strong>{exp.paidBy}</strong> 先付</span>
                                            <span>·</span>
                                            <span>分攤人: {exp.participants?.join(', ')}</span>
                                            {exp.currency !== baseCurrency && (
                                                <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.2 rounded font-mono">
                                                    匯率 {exp.rateToTripBase} 已凍結
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 shrink-0">
                                    <div className="text-right">
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
                                        onClick={() => handleDeleteExpense(exp.id)}
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

            {/* 4. 新增支出 Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-800 animate-in fade-in zoom-in-95 duration-150">
                        <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                            <Plus className="w-5 h-5 text-indigo-600" /> 記錄新支出
                        </h3>
                        <form onSubmit={handleAddExpenseSubmit} className="space-y-3.5">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">消費項目</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="例如：一蘭拉麵、晴空塔門票"
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
                                        placeholder="例如：我 或 Alice"
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
                                        placeholder="0"
                                        value={formAmount}
                                        onChange={(e) => setFormAmount(e.target.value)}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">幣別</label>
                                    <select
                                        value={formCurrency}
                                        onChange={(e) => setFormCurrency(e.target.value)}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                                    >
                                        {SUPPORTED_CURRENCIES.map(c => (
                                            <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* 匯率預覽 */}
                            <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-900 flex items-center justify-between">
                                <span className="flex items-center gap-1">
                                    <Lock className="w-3.5 h-3.5 text-indigo-500" />
                                    <span>Frankfurter 即時匯率: 1 {formCurrency} ≈ {liveRate} {baseCurrency}</span>
                                </span>
                                {formAmount > 0 && (
                                    <span className="font-bold">
                                        ≈ ${Math.round(formAmount * liveRate).toLocaleString()} {baseCurrency}
                                    </span>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">分攤人員 (以逗號分隔)</label>
                                <input
                                    type="text"
                                    value={participantsText}
                                    onChange={(e) => setParticipantsText(e.target.value)}
                                    placeholder="我, 旅伴A, 旅伴B"
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                                />
                                <p className="text-[11px] text-slate-400 mt-1">採用最大餘數法平分，精確至最小整數分無小數誤差</p>
                            </div>

                            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700"
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-md transition"
                                >
                                    記錄支出
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 5. 智慧清帳還款建議 Modal */}
            {isSettleModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl text-slate-800 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-base flex items-center gap-2">
                                <Split className="w-5 h-5 text-indigo-600" /> 智慧清帳與最簡還款建議
                            </h3>
                            <button onClick={() => setIsSettleModalOpen(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
                        </div>

                        {/* 各人借貸淨額 */}
                        <div className="mb-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">成員淨餘額</h4>
                            <div className="space-y-1.5">
                                {Object.entries(netBalances).map(([user, balance]) => (
                                    <div key={user} className="flex items-center justify-between text-xs">
                                        <span className="font-semibold text-slate-700">{user}</span>
                                        <span className={`font-mono font-bold ${balance > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {balance > 0 ? `應收 +$${balance.toLocaleString()}` : `應付 -$${Math.abs(balance).toLocaleString()}`} {baseCurrency}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 最小交易撮合清單 */}
                        <div className="space-y-2 mb-6">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">最少轉帳筆數方案</h4>
                            {settleTransactions.length === 0 ? (
                                <p className="text-xs text-emerald-600 font-bold py-4 text-center">所有帳目已全部平衡結清！</p>
                            ) : (
                                settleTransactions.map((tx, idx) => (
                                    <div key={idx} className="bg-indigo-50/60 border border-indigo-100 p-3 rounded-xl flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2 font-bold text-slate-800">
                                            <span className="text-rose-700">{tx.from}</span>
                                            <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
                                            <span className="text-emerald-700">{tx.to}</span>
                                        </div>
                                        <div className="font-mono font-bold text-indigo-700">
                                            ${tx.amount.toLocaleString()} {baseCurrency}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-100">
                            <button
                                onClick={() => exportExpensesToCSV(activeTrip.title, expenses, settleTransactions)}
                                className="px-3.5 py-2 border border-gray-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition flex items-center gap-1.5"
                            >
                                <Download className="w-3.5 h-3.5" />
                                <span>匯出結算清單</span>
                            </button>
                            {settleTransactions.length > 0 && (
                                <button
                                    onClick={handleSettleAll}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition"
                                >
                                    一鍵標記全部結清
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
