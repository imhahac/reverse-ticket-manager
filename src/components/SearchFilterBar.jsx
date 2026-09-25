import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { useUIContext } from '../contexts/UIContext';
import { useDebounce } from '../hooks/useDebounce';
import { TIMING } from '../constants/timing';

export default function SearchFilterBar() {
    const { searchTerm, setSearchTerm, filterStatus, setFilterStatus } = useUIContext();
    // 本地 state 控制 input 即時顯示，debounce 後才寫入 context
    const [inputValue, setInputValue] = useState(searchTerm);
    const debouncedValue = useDebounce(inputValue, TIMING.DEBOUNCE_SEARCH);

    useEffect(() => {
        setSearchTerm(debouncedValue);
    }, [debouncedValue, setSearchTerm]);

    // 若外部清空 searchTerm（例如重設），同步回 input
    useEffect(() => {
        if (searchTerm === '') setInputValue('');
    }, [searchTerm]);

    return (
        <div className="flex flex-col md:flex-row gap-3 items-center bg-slate-50/60 p-2.5 rounded-xl border border-slate-200/80">
            <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                    type="text" 
                    placeholder="搜尋航班代號、機場代碼、飯店名稱或活動憑證..."
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-800 placeholder:text-slate-400 shadow-2xs"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                />
            </div>
            <div className="flex gap-1 bg-slate-200/70 p-1 rounded-lg w-full md:w-auto shrink-0">
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
