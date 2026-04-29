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
        <div className="bg-slate-50 border-r border-slate-200 p-5 flex flex-col justify-center items-center rounded-l-xl w-full md:w-56 shrink-0 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-slate-200/50 to-transparent rounded-bl-full pointer-events-none" />
            {editingLabelId === comboKey ? (
                <div className="flex flex-col gap-2 w-full mt-2 relative z-10">
                    <input autoFocus type="text" className="w-full text-sm p-1.5 border border-indigo-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500" value={editLabelValue} onChange={e => setEditLabelValue(e.target.value)} placeholder="自訂行程名稱..." onKeyDown={e => e.key === 'Enter' && onSaveLabel(comboKey)} />
                    <div className="flex justify-end gap-1">
                        <button onClick={() => onSaveLabel(comboKey)} className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={onCancelEditing} className="p-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"><X className="w-3.5 h-3.5" /></button>
                    </div>
                </div>
            ) : (
                <div className="group flex items-center gap-1.5 text-slate-800 font-black text-xl mb-3 text-center relative cursor-pointer z-10" onClick={() => onStartEditing(comboKey, customLabel)}>
                    <span>{customLabel}</span>
                    <Edit3 className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                </div>
            )}
            <div className="text-2xl font-black text-slate-900 mb-1 tracking-tight">NT$ {Math.round(grandTotalTWD).toLocaleString()}</div>
            {totalHotelCostTWD > 0 && <div className="text-[10px] text-slate-500 mb-1 text-center">機票 {Math.round(totalCostTWD).toLocaleString()} + 住宿 {Math.round(totalHotelCostTWD).toLocaleString()}</div>}
            {tripDays && tripDays > 0 && (
                <div className="text-[10px] font-bold text-indigo-900 bg-indigo-100/80 px-2 py-1.5 rounded-md border border-indigo-200 mt-2 flex flex-col items-center gap-0.5 shadow-sm">
                    <span className="text-[8px] uppercase tracking-tighter opacity-60">每日平均成本 (CP 值)</span>
                    <span>NT$ {Math.round(grandTotalTWD / tripDays).toLocaleString()} / 天</span>
                </div>
            )}
            {segmentsCount > 0 && <div className="text-xs font-bold text-slate-400 bg-slate-200/50 px-2 py-1.5 rounded-md mt-1 border border-slate-200/50">🛫 共 {segmentsCount} 段航班</div>}
            
            {/* 預算設定 */}
            <div className="mt-3 w-full">
                {isEditingBudget ? (
                    <div className="flex flex-col gap-1 w-full relative z-10 bg-white p-1.5 rounded shadow-sm border border-slate-200">
                        <input autoFocus type="number" className="w-full text-xs p-1 border border-emerald-300 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500" value={budgetInput} onChange={e => setBudgetInput(e.target.value)} placeholder="總預算..." onKeyDown={e => e.key === 'Enter' && handleSaveBudget()} />
                        <div className="flex justify-end gap-1">
                            <button onClick={handleSaveBudget} className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200"><Check className="w-3 h-3" /></button>
                            <button onClick={() => setIsEditingBudget(false)} className="p-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"><X className="w-3 h-3" /></button>
                        </div>
                    </div>
                ) : (
                    <div className="group flex items-center justify-center gap-1 text-[10px] text-slate-500 hover:text-emerald-600 transition-colors cursor-pointer relative z-10" onClick={handleStartEditBudget}>
                        <PiggyBank className="w-3 h-3" />
                        <span>{currentBudget > 0 ? `預算: NT$ ${currentBudget.toLocaleString()}` : '設定預算'}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
