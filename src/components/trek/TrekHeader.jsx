/**
 * TrekHeader.jsx
 * 現代化頂部導航列：包含旅程切換器 (Trip Switcher)、新旅程建立、
 * 雙欄佈局視角切換器、以及 Google Drive 雲端同步狀態
 */

import React, { useState } from 'react';
import { 
    Compass, 
    Calendar, 
    Plus, 
    ChevronDown, 
    Columns, 
    Maximize2, 
    LayoutList, 
    Cloud, 
    Check, 
    RefreshCw,
    Trash2,
    Share2
} from 'lucide-react';
import { useTrek } from '../../contexts/TrekContext';
import { useUIContext } from '../../contexts/UIContext';
import { useSyncContext } from '../../contexts/SyncContext';
import ExportImportModal from './ExportImportModal';

export default function TrekHeader() {
    const { 
        trips, 
        activeTrip, 
        activeTripId, 
        selectTrip, 
        createTrip, 
        deleteTrip, 
        viewMode, 
        setViewMode 
    } = useTrek();

    const { activeTab, setActiveTab } = useUIContext();
    const { isSyncing, handleSyncToDrive, handleLoadFromDrive } = useSyncContext();

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newStartDate, setNewStartDate] = useState(new Date().toISOString().slice(0, 10));
    const [newEndDate, setNewEndDate] = useState(new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10));
    const [newCurrency, setNewCurrency] = useState('TWD');

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        if (!newTitle.trim()) return;
        await createTrip({
            title: newTitle.trim(),
            startDate: newStartDate,
            endDate: newEndDate,
            baseCurrency: newCurrency
        });
        setNewTitle('');
        setIsCreateModalOpen(false);
        setIsDropdownOpen(false);
    };

    return (
        <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-md">
            <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
                {/* 1. Brand Logo & Title */}
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <Compass className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-extrabold text-base sm:text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-indigo-200">
                                Light Trip Plan
                            </span>
                            <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 tracking-widest">
                                Pro
                            </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium hidden sm:block">智能離線旅遊規劃系統</p>
                    </div>
                </div>

                {/* 2. Trip Switcher Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 px-3 py-1.5 rounded-lg text-sm transition-all text-slate-200"
                    >
                        <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span className="font-semibold max-w-[150px] sm:max-w-[200px] truncate">
                            {activeTrip ? activeTrip.title : '選擇或建立旅程'}
                        </span>
                        {activeTrip && (
                            <span className="text-xs text-slate-400 hidden md:inline">
                                ({activeTrip.startDate} ~ {activeTrip.endDate?.slice(5)})
                            </span>
                        )}
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    </button>

                    {isDropdownOpen && (
                        <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-72 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl py-2 z-50">
                            <div className="px-3 py-1.5 border-b border-slate-700/60 flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
                                <span>所有旅程 ({trips.length})</span>
                                <button
                                    onClick={() => { setIsCreateModalOpen(true); setIsDropdownOpen(false); }}
                                    className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300"
                                >
                                    <Plus className="w-3.5 h-3.5" /> 新增
                                </button>
                            </div>
                            <div className="max-h-60 overflow-y-auto py-1">
                                {trips.length === 0 ? (
                                    <div className="px-4 py-3 text-xs text-slate-400 text-center">尚無旅程，請點擊新增</div>
                                ) : (
                                    trips.map(trip => (
                                        <div
                                            key={trip.id}
                                            className={`px-3 py-2 flex items-center justify-between hover:bg-slate-700/60 cursor-pointer ${trip.id === activeTripId ? 'bg-indigo-500/10 text-indigo-300 font-bold' : 'text-slate-300'}`}
                                            onClick={() => { selectTrip(trip.id); setIsDropdownOpen(false); }}
                                        >
                                            <div className="truncate pr-2">
                                                <div className="text-sm truncate">{trip.title}</div>
                                                <div className="text-[11px] text-slate-400">{trip.startDate} ~ {trip.endDate}</div>
                                            </div>
                                            {trips.length > 1 && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (confirm(`確定要刪除旅程「${trip.title}」及其所有預訂與日程嗎？`)) {
                                                            deleteTrip(trip.id);
                                                        }
                                                    }}
                                                    className="text-slate-500 hover:text-red-400 p-1 rounded"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* 3. Right Toolbar: View Layout Toggles & Cloud Sync */}
                <div className="flex items-center gap-2">
                    {/* View mode toggle (Split / List / Map) */}
                    <div className="hidden lg:flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 text-slate-400">
                        <button
                            onClick={() => setViewMode('split')}
                            title="雙欄佈局 (左時間軸 + 右地圖)"
                            className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition ${viewMode === 'split' ? 'bg-indigo-600 text-white shadow-sm' : 'hover:text-white'}`}
                        >
                            <Columns className="w-3.5 h-3.5" />
                            <span>雙欄</span>
                        </button>
                        <button
                            onClick={() => setViewMode('planner-only')}
                            title="純時間軸專案檢視"
                            className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition ${viewMode === 'planner-only' ? 'bg-indigo-600 text-white shadow-sm' : 'hover:text-white'}`}
                        >
                            <LayoutList className="w-3.5 h-3.5" />
                            <span>日程</span>
                        </button>
                        <button
                            onClick={() => setViewMode('map-only')}
                            title="全螢幕地圖"
                            className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition ${viewMode === 'map-only' ? 'bg-indigo-600 text-white shadow-sm' : 'hover:text-white'}`}
                        >
                            <Maximize2 className="w-3.5 h-3.5" />
                            <span>地圖</span>
                        </button>
                    </div>

                    {/* 匯入匯出與手冊按鈕 */}
                    {activeTrip && (
                        <button
                            onClick={() => setIsExportModalOpen(true)}
                            title="匯入景點、行事曆/航跡匯出、日期平移與手冊"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-bold text-white transition shadow-sm"
                        >
                            <Share2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">匯入匯出 & 手冊</span>
                        </button>
                    )}

                    {/* Google Drive Sync Controls */}
                    <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
                        <button
                            onClick={handleSyncToDrive}
                            disabled={isSyncing}
                            title="備份至 Google Drive"
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-medium text-slate-200 transition disabled:opacity-50"
                        >
                            <Cloud className={`w-3.5 h-3.5 ${isSyncing ? 'animate-bounce text-amber-400' : 'text-emerald-400'}`} />
                            <span className="hidden sm:inline">備份</span>
                        </button>
                        <button
                            onClick={handleLoadFromDrive}
                            disabled={isSyncing}
                            title="從 Google Drive 還原"
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-400 hover:text-slate-200 transition disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Create Trip Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-100 animate-in fade-in zoom-in-95 duration-150">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-indigo-400" /> 建立新旅程
                        </h3>
                        <form onSubmit={handleCreateSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">旅程名稱</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="例如：2025 東京富士山賞櫻"
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">出發日期</label>
                                    <input
                                        type="date"
                                        required
                                        value={newStartDate}
                                        onChange={(e) => setNewStartDate(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">回程日期</label>
                                    <input
                                        type="date"
                                        required
                                        value={newEndDate}
                                        onChange={(e) => setNewEndDate(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">結算基準幣別</label>
                                <select
                                    value={newCurrency}
                                    onChange={(e) => setNewCurrency(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                >
                                    <option value="TWD">TWD - 新台幣 (預設)</option>
                                    <option value="JPY">JPY - 日圓</option>
                                    <option value="USD">USD - 美元</option>
                                    <option value="EUR">EUR - 歐元</option>
                                    <option value="KRW">KRW - 韓元</option>
                                    <option value="THB">THB - 泰銖</option>
                                </select>
                            </div>
                            <div className="flex justify-end gap-3 pt-3 border-t border-slate-700/60">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white"
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-bold text-white shadow-lg shadow-indigo-600/30 transition"
                                >
                                    建立旅程
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 匯入匯出與手冊 Modal */}
            <ExportImportModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
            />
        </header>
    );
}
