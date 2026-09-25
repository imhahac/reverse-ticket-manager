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
    Share2,
    LogIn,
    LogOut,
    CloudUpload,
    CloudDownload,
    ShieldCheck,
    Info,
    X,
    Edit2
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
        updateTrip,
        deleteTrip, 
        viewMode, 
        setViewMode 
    } = useTrek();

    const { activeTab, setActiveTab, configWarnings } = useUIContext();
    const { 
        accessToken, 
        login, 
        logout, 
        isSyncing, 
        handleSyncToDrive, 
        handleLoadFromDrive, 
        handleSyncToCalendar 
    } = useSyncContext();

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

    const [newTitle, setNewTitle] = useState('');
    const [newStartDate, setNewStartDate] = useState(new Date().toISOString().slice(0, 10));
    const [newEndDate, setNewEndDate] = useState(new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10));
    const [newCurrency, setNewCurrency] = useState('TWD');

    // 編輯現有旅程狀態
    const [editingTrip, setEditingTrip] = useState(null);
    const [editTitle, setEditTitle] = useState('');
    const [editStartDate, setEditStartDate] = useState('');
    const [editEndDate, setEditEndDate] = useState('');
    const [editCurrency, setEditCurrency] = useState('TWD');

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

    const handleOpenEdit = (trip, e) => {
        e.stopPropagation();
        setEditingTrip(trip);
        setEditTitle(trip.title || '');
        setEditStartDate(trip.startDate || '');
        setEditEndDate(trip.endDate || '');
        setEditCurrency(trip.baseCurrency || 'TWD');
        setIsDropdownOpen(false);
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        if (!editingTrip || !editTitle.trim()) return;
        await updateTrip({
            ...editingTrip,
            title: editTitle.trim(),
            startDate: editStartDate,
            endDate: editEndDate,
            baseCurrency: editCurrency
        });
        setEditingTrip(null);
    };

    return (
        <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-md">
            <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
                {/* 1. Brand Logo & Title & System Status */}
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
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
                            {/* 系統運行狀態徽章 (免去刺眼的黃色全域膠帶) */}
                            <button
                                onClick={() => setIsStatusModalOpen(true)}
                                className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-800/90 hover:bg-slate-700/80 border border-slate-700/60 text-[10px] text-slate-300 font-medium transition"
                                title="檢視系統環境與運行狀態"
                            >
                                <span className={`w-1.5 h-1.5 rounded-full ${accessToken ? 'bg-emerald-400 animate-pulse' : 'bg-indigo-400'}`} />
                                <span>{accessToken ? '雲端就緒' : '離線就緒'}</span>
                                {configWarnings && configWarnings.length > 0 && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="有配置提示" />
                                )}
                            </button>
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
                        <span className="font-semibold max-w-[140px] sm:max-w-[200px] truncate">
                            {activeTrip ? activeTrip.title : '選擇或建立旅程'}
                        </span>
                        {activeTrip && (
                            <span className="text-xs text-slate-400 hidden lg:inline">
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
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    onClick={(e) => handleOpenEdit(trip, e)}
                                                    className="text-slate-400 hover:text-indigo-300 p-1 rounded hover:bg-slate-600/50 transition"
                                                    title="編輯旅程"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (confirm(`確定要刪除旅程「${trip.title}」及其所有預訂與日程嗎？此操作無法復原。`)) {
                                                            deleteTrip(trip.id);
                                                        }
                                                    }}
                                                    className="text-slate-400 hover:text-rose-400 p-1 rounded hover:bg-slate-600/50 transition"
                                                    title="刪除旅程"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* 3. Right Toolbar: Context-Aware Layout Toggles & Google Auth Hub */}
                <div className="flex items-center gap-2">
                    {/* View mode toggle: 僅在行程規劃工作台 (activeTab === 'planner') 顯示 */}
                    {activeTab === 'planner' && (
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
                    )}

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

                    {/* Google 帳號與雲端同步中心 (首頁必備核心) */}
                    <div className="flex items-center pl-1 border-l border-slate-800">
                        {!accessToken ? (
                            <button
                                onClick={() => login()}
                                className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs rounded-lg shadow-sm transition active:scale-95 border border-slate-200"
                                title="登入 Google 帳號以啟用雲端備份與日曆同步"
                            >
                                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                                </svg>
                                <span>Google 登入</span>
                            </button>
                        ) : (
                            <div className="relative">
                                <button
                                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-200 transition shadow-sm"
                                >
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                    <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="hidden sm:inline">Google 已連結</span>
                                    <ChevronDown className="w-3 h-3 text-slate-400" />
                                </button>

                                {isUserMenuOpen && (
                                    <div className="absolute right-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                                        <div className="px-3.5 py-2.5 border-b border-slate-700/80">
                                            <div className="flex items-center gap-2 text-xs font-bold text-white">
                                                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                                <span>Google 雲端帳號已連結</span>
                                            </div>
                                            <p className="text-[11px] text-slate-400 mt-0.5">已授權：Google Drive &amp; Calendar</p>
                                        </div>
                                        <div className="py-1 px-1">
                                            <button
                                                onClick={() => { handleSyncToDrive(); setIsUserMenuOpen(false); }}
                                                disabled={isSyncing}
                                                className="w-full text-left px-3 py-2 text-xs font-medium rounded-lg hover:bg-slate-700 text-slate-200 flex items-center justify-between transition disabled:opacity-50"
                                            >
                                                <span className="flex items-center gap-2">
                                                    <CloudUpload className="w-4 h-4 text-indigo-400" /> 備份旅程至 Google Drive
                                                </span>
                                                {isSyncing && <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />}
                                            </button>
                                            <button
                                                onClick={() => { handleLoadFromDrive(); setIsUserMenuOpen(false); }}
                                                disabled={isSyncing}
                                                className="w-full text-left px-3 py-2 text-xs font-medium rounded-lg hover:bg-slate-700 text-slate-200 flex items-center gap-2 transition disabled:opacity-50"
                                            >
                                                <CloudDownload className="w-4 h-4 text-emerald-400" /> 從 Google Drive 還原旅程
                                            </button>
                                            <button
                                                onClick={() => { handleSyncToCalendar(); setIsUserMenuOpen(false); }}
                                                disabled={isSyncing}
                                                className="w-full text-left px-3 py-2 text-xs font-medium rounded-lg hover:bg-slate-700 text-slate-200 flex items-center gap-2 transition disabled:opacity-50"
                                            >
                                                <Calendar className="w-4 h-4 text-blue-400" /> 一鍵同步至 Google 日曆
                                            </button>
                                        </div>
                                        <div className="border-t border-slate-700/80 pt-1 mt-1 px-1">
                                            <button
                                                onClick={() => { logout(); setIsUserMenuOpen(false); }}
                                                className="w-full text-left px-3 py-2 text-xs font-semibold rounded-lg hover:bg-red-500/10 text-red-400 flex items-center gap-2 transition"
                                            >
                                                <LogOut className="w-4 h-4" /> 登出 Google 帳號
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 系統運行環境與狀態 Modal */}
            {isStatusModalOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-100 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-700">
                            <h3 className="text-base font-bold flex items-center gap-2 text-white">
                                <ShieldCheck className="w-5 h-5 text-indigo-400" /> 系統運行環境與就緒狀態
                            </h3>
                            <button onClick={() => setIsStatusModalOpen(false)} className="text-slate-400 hover:text-white">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="space-y-3 text-xs">
                            <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-700/60">
                                <div className="font-semibold text-slate-300 mb-1 flex items-center justify-between">
                                    <span>本地沙盒離線存儲</span>
                                    <span className="text-emerald-400 font-bold">100% 離線就緒</span>
                                </div>
                                <p className="text-slate-400 text-[11px] leading-relaxed">
                                    資料優先持久化至本地 IndexedDB 與 LocalStorage，無網路亦可順暢規劃。
                                </p>
                            </div>
                            <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-700/60">
                                <div className="font-semibold text-slate-300 mb-1 flex items-center justify-between">
                                    <span>向量圖資引擎 (MapLibre GL)</span>
                                    <span className="text-emerald-400 font-bold">免 Token 正常運作</span>
                                </div>
                                <p className="text-slate-400 text-[11px] leading-relaxed">
                                    支援 OSM 標準底圖、Carto Voyager 商業街圖與 OpenFreeMap 向量圖資。
                                </p>
                            </div>
                            <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-700/60">
                                <div className="font-semibold text-slate-300 mb-1 flex items-center justify-between">
                                    <span>Google 雲端同步與備份</span>
                                    <span className={accessToken ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                                        {accessToken ? '已連線' : '未登入 (可選)'}
                                    </span>
                                </div>
                                <p className="text-slate-400 text-[11px] leading-relaxed">
                                    登入 Google 帳號後，可手動將所有行程備份至 Google Drive 或同步至 Google Calendar。
                                </p>
                            </div>
                            {configWarnings && configWarnings.length > 0 && (
                                <div className="bg-amber-950/30 p-3 rounded-xl border border-amber-500/30 text-amber-200">
                                    <div className="font-bold flex items-center gap-1.5 mb-1 text-amber-300">
                                        <Info className="w-3.5 h-3.5" /> 系統配置提示
                                    </div>
                                    <ul className="list-disc pl-4 space-y-1 text-[11px]">
                                        {configWarnings.map((warn, i) => (
                                            <li key={i}>{warn}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                        <div className="mt-5 pt-3 border-t border-slate-700 flex justify-end">
                            <button
                                onClick={() => setIsStatusModalOpen(false)}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs transition"
                            >
                                關閉
                            </button>
                        </div>
                    </div>
                </div>
            )}

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

            {/* 編輯現有旅程 Modal */}
            {editingTrip && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl text-white animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between mb-4 border-b border-slate-700/60 pb-3">
                            <h3 className="font-bold text-base flex items-center gap-2">
                                <Edit2 className="w-4 h-4 text-indigo-400" />
                                <span>編輯旅程資訊</span>
                            </h3>
                            <button
                                onClick={() => setEditingTrip(null)}
                                className="text-slate-400 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleEditSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">旅程名稱</label>
                                <input
                                    type="text"
                                    required
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">出發日期</label>
                                    <input
                                        type="date"
                                        required
                                        value={editStartDate}
                                        onChange={(e) => setEditStartDate(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">回程日期</label>
                                    <input
                                        type="date"
                                        required
                                        value={editEndDate}
                                        onChange={(e) => setEditEndDate(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">結算基準幣別</label>
                                <select
                                    value={editCurrency}
                                    onChange={(e) => setEditCurrency(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                >
                                    <option value="TWD">TWD - 新台幣</option>
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
                                    onClick={() => setEditingTrip(null)}
                                    className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white"
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-bold text-white shadow-lg shadow-indigo-600/30 transition"
                                >
                                    儲存修改
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
