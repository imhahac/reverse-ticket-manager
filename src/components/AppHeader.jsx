import React from 'react';
// import PropTypes from 'prop-types'; // no longer needed
import { Plane, Calendar, Download, Upload, Cloud, CloudUpload, CloudDownload, LogOut, LogIn } from 'lucide-react';
import { useSystemDataContext } from '../contexts/DataContext';
import { useSyncContext } from '../contexts/SyncContext';
import { useUIContext } from '../contexts/UIContext';

export default function AppHeader() {
    const {
        accessToken,
        isSyncing,
        handleSyncToDrive,
        handleLoadFromDrive,
        handleSyncToCalendar,
        logout,
        login,
    } = useSyncContext();
    const { handleExport, handleImport } = useSystemDataContext();
    const { fileInputRef } = useUIContext();
    return (
        <header className="mb-8 pt-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-3 tracking-tight flex items-center">
                    <Plane className="w-8 h-8 mr-3 text-indigo-600" /> 差旅行程管理系統
                </h1>
                <p className="text-slate-500 text-lg">機票反向防呆 ✈️ + 飯店住宿管理 🏨 一站整合</p>
            </div>
            <div className="flex flex-col gap-2 w-full md:w-auto">
                {accessToken ? (
                    <div className="flex flex-wrap gap-2 justify-end bg-indigo-50 p-2 rounded-lg border border-indigo-100">
                        <span className="flex items-center text-xs font-bold text-indigo-600 w-full mb-1">
                            <Cloud className="w-3 h-3 mr-1" /> 已連結 Google (Drive &amp; Calendar)
                        </span>
                        <button onClick={handleSyncToDrive} disabled={isSyncing} className="flex items-center px-3 py-1.5 bg-white border border-indigo-200 text-indigo-700 font-bold text-sm rounded shadow-sm hover:bg-indigo-50 transition min-w-[120px] justify-center disabled:opacity-50">
                            <CloudUpload className="w-4 h-4 mr-1.5" /> 雲端備份
                        </button>
                        <button onClick={handleLoadFromDrive} disabled={isSyncing} className="flex items-center px-3 py-1.5 bg-white border border-indigo-200 text-indigo-700 font-bold text-sm rounded shadow-sm hover:bg-indigo-50 transition min-w-[120px] justify-center disabled:opacity-50">
                            <CloudDownload className="w-4 h-4 mr-1.5" /> 雲端載入
                        </button>
                        <button onClick={handleSyncToCalendar} disabled={isSyncing} className="flex items-center px-3 py-1.5 bg-indigo-600 border border-indigo-700 text-white font-bold text-sm rounded shadow-sm hover:bg-indigo-700 transition min-w-[120px] justify-center disabled:opacity-50">
                            <Calendar className="w-4 h-4 mr-1.5" /> 同步日曆
                        </button>
                        <button onClick={logout} disabled={isSyncing} className="flex items-center px-3 py-1.5 bg-gray-100 border border-gray-200 text-gray-600 font-bold text-sm rounded shadow-sm hover:bg-gray-200 transition">
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2 justify-end border p-2 rounded-lg bg-white border-gray-200 shadow-sm">
                        <button onClick={() => login()} className="flex items-center px-4 py-2 bg-indigo-600 text-white font-bold text-sm rounded hover:bg-indigo-700 transition">
                            <LogIn className="w-4 h-4 mr-2" /> 登入 Google 啟用雲端功能
                        </button>
                    </div>
                )}
                <div className="flex gap-2 justify-end mt-1">
                    <button onClick={handleExport} className="flex items-center px-3 py-1.5 bg-white border border-gray-200 text-gray-500 font-bold text-xs rounded hover:bg-gray-50 transition">
                        <Download className="w-3 h-3 mr-1" /> 本地匯出 JSON
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center px-3 py-1.5 bg-white border border-gray-200 text-gray-500 font-bold text-xs rounded hover:bg-gray-50 transition">
                        <Upload className="w-3 h-3 mr-1" /> 本地匯入 JSON
                    </button>
                    <input type="file" accept=".json" ref={fileInputRef} className="hidden" onChange={handleImport} />
                </div>
            </div>
        </header>
    );
}

