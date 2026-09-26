import React from 'react';
import { Edit3, Check, X, PiggyBank } from 'lucide-react';
import { useTicketDataContext } from '../../contexts/DataContext';

export default function TripCostPanel({ 
    comboKey, grandTotalTWD, totalCostTWD, totalHotelCostTWD, tripDays, 
    segmentsCount, customLabel, editingLabelId, editLabelValue, 
    setEditLabelValue, onStartEditing, onSaveLabel, onCancelEditing 
}) {
    const { tripBudgets, setTripBudgets } = useTicketDataContext();
    const [isEditingBudget, setIsEditingBudget] = React.useState(false);
    const [budgetInput, setBudgetInput] = React.useState('');

    const currentBudget = tripBudgets?.[comboKey] || 0;

    const handleSaveBudget = () => {
        const val = parseInt(budgetInput, 10);
        if (!isNaN(val) && val >= 0) {
            setTripBudgets(prev => ({ ...prev, [comboKey]: val }));
        }
        setIsEditingBudget(false);
    };

    const handleStartEditBudget = () => {
        setBudgetInput(currentBudget > 0 ? String(currentBudget) : '');
        setIsEditingBudget(true);
    };

    return (
        <div className="bg-slate-50/90 border-b xl:border-b-0 xl:border-r border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row xl:flex-col justify-between xl:justify-center items-center rounded-t-xl xl:rounded-t-none xl:rounded-l-xl w-full xl:w-56 shrink-0 relative overflow-hidden gap-3 xl:gap-2">
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-slate-200/50 to-transparent rounded-bl-full pointer-events-none" />
            
            {/* 名稱與預算區塊 */}
            <div className="flex flex-col items-center sm:items-start xl:items-center w-full sm:w-auto xl:w-full">
                {editingLabelId === comboKey ? (
                    <div className="flex flex-col gap-1.5 w-full relative z-10">
                        <input autoFocus type="text" className="w-full text-sm p-1.5 border border-indigo-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500" value={editLabelValue} onChange={e => setEditLabelValue(e.target.value)} placeholder="自訂行程名稱..." onKeyDown={e => e.key === 'Enter' && onSaveLabel(comboKey)} />
                        <div className="flex justify-end gap-1">
                            <button onClick={() => onSaveLabel(comboKey)} className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={onCancelEditing} className="p-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"><X className="w-3.5 h-3.5" /></button>
                        </div>
                    </div>
                ) : (
                    <div className="group flex items-center gap-1.5 text-slate-800 font-black text-lg xl:text-xl mb-1 text-center relative cursor-pointer z-10" onClick={() => onStartEditing(comboKey, customLabel)}>
                        <span className="truncate max-w-[200px]">{customLabel}</span>
                        <Edit3 className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500 transition-colors shrink-0" />
                    </div>
                )}

                {/* 預算快捷設定 */}
                <div className="w-full mt-1">
                    {isEditingBudget ? (
                        <div className="flex flex-col gap-1 w-full relative z-10 bg-white p-1.5 rounded shadow-sm border border-slate-200">
                            <input autoFocus type="number" className="w-full text-xs p-1 border border-emerald-300 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500" value={budgetInput} onChange={e => setBudgetInput(e.target.value)} placeholder="總預算..." onKeyDown={e => e.key === 'Enter' && handleSaveBudget()} />
                            <div className="flex justify-end gap-1">
                                <button onClick={handleSaveBudget} className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200"><Check className="w-3 h-3" /></button>
                                <button onClick={() => setIsEditingBudget(false)} className="p-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"><X className="w-3 h-3" /></button>
                            </div>
                        </div>
                    ) : (
                        <div className="group flex items-center justify-center sm:justify-start xl:justify-center gap-1 text-[11px] text-slate-500 hover:text-emerald-600 transition-colors cursor-pointer relative z-10" onClick={handleStartEditBudget}>
                            <PiggyBank className="w-3 h-3 shrink-0" />
                            <span>{currentBudget > 0 ? `預算: NT$ ${currentBudget.toLocaleString()}` : '設定預算'}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* 總費用核心數字 */}
            <div className="flex flex-col items-center my-0.5">
                <div className="text-xl xl:text-2xl font-black text-slate-900 tracking-tight">NT$ {Math.round(grandTotalTWD).toLocaleString()}</div>
                {totalHotelCostTWD > 0 && <div className="text-[10px] text-slate-500 text-center">機票 {Math.round(totalCostTWD).toLocaleString()} + 住宿 {Math.round(totalHotelCostTWD).toLocaleString()}</div>}
            </div>

            {/* 標籤徽章與統計 */}
            <div className="flex sm:flex-col xl:flex-col items-center sm:items-end xl:items-center gap-1 shrink-0">
                {tripDays && tripDays > 0 && (
                    <div className="text-[10px] font-bold text-indigo-900 bg-indigo-100/80 px-2 py-1 rounded-md border border-indigo-200 flex items-center gap-1 shadow-xs">
                        <span className="opacity-70">均值</span>
                        <span>NT$ {Math.round(grandTotalTWD / tripDays).toLocaleString()} / 天</span>
                    </div>
                )}
                {segmentsCount > 0 && <div className="text-[10px] font-bold text-slate-500 bg-slate-200/60 px-2 py-1 rounded-md border border-slate-200/50">🛫 {segmentsCount} 段航班</div>}
            </div>
        </div>
    );
}
