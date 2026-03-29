import React from 'react';
import { useAppContext } from '../contexts/AppContext';

export default function SearchFilterBar() {
    const { searchTerm, setSearchTerm, filterStatus, setFilterStatus } = useAppContext();
    return (
        <div className="mb-6 flex flex-col md:flex-row gap-3 items-center bg-white p-3 rounded-xl shadow-sm border border-slate-200">
            <div className="relative flex-1 w-full">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                <input 
                    type="text" 
                    placeholder="搜尋航班、機場、飯店或自訂名稱..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-full md:w-auto">
                {[
                    { key: 'all', label: '全部' },
                    { key: 'upcoming', label: '未來' },
                    { key: 'warning', label: '⚠️ 警告' }
                ].map(opt => (
                    <button
                        key={opt.key}
                        onClick={() => setFilterStatus(opt.key)}
                        className={`flex-1 md:flex-none px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                            filterStatus === opt.key 
                                ? 'bg-white text-indigo-600 shadow-sm' 
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
