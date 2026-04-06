import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { AppProvider } from './contexts/AppContext';
import { useFilterContext } from './contexts/FilterContext';
import { UIProvider, useUIContext } from './contexts/UIContext';

// ── UI Components ──────────────────────────────────────────────────────────
import Instructions from './components/Instructions';
import Dashboard from './components/Dashboard';
import TicketForm from './components/TicketForm';
import HotelForm from './features/hotels/components/HotelForm';
import ActivityForm from './components/ActivityForm';
import AppHeader from './components/AppHeader';
import BottomNav from './components/BottomNav';
import SearchFilterBar from './components/SearchFilterBar';
import TabContent from './components/TabContent';
import CostDashboard from './components/CostDashboard';

// ── Constants ──────────────────────────────────────────────────────────────
const TABS = [
    { key: 'timeline',   label: '📆 行程 Timeline' },
    { key: 'list',       label: '🎟️ 機票管理' },
    { key: 'hotels',     label: '🏨 飯店管理' },
    { key: 'activities', label: '🎫 票卷與活動' },
    { key: 'calendar',   label: '📅 月曆' },
    { key: 'map',        label: '🗺️ 地圖' },
    { key: 'analytics',  label: '📊 成本分析' },
];

const FORM_COMPONENT_BY_TAB = {
    timeline: TicketForm,
    list: TicketForm,
    hotels: HotelForm,
    activities: ActivityForm,
};

const CONTENT_COMPONENT_BY_TAB = {
    analytics: CostDashboard,
};

function AppContent() {
    const { 
        activeTab, setActiveTab, configWarnings, setConfigWarnings 
    } = useUIContext();
    const { renderError } = useFilterContext();

    if (renderError) {
        return (
            <div className="min-h-screen p-8 flex items-center justify-center bg-slate-50">
                <div className="max-w-md w-full bg-white p-6 rounded-2xl shadow-xl border border-red-100 text-center">
                    <div className="text-5xl mb-4">😵</div>
                    <h1 className="text-xl font-bold text-slate-800 mb-2">程式發生非預期錯誤</h1>
                    <p className="text-sm text-slate-500 mb-6">這通常是因為瀏覽器儲存的資料格式損毀所致。我們建議您重設資料後重新載入。</p>
                    <div className="bg-red-50 p-3 rounded-lg mb-6 text-left">
                        <p className="text-[10px] font-mono text-red-600 break-all leading-tight">Error: {renderError}</p>
                    </div>
                    <div className="flex flex-col gap-3">
                        <button onClick={() => window.location.reload()} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition">重新整理網頁</button>
                        <button onClick={() => { if (confirm('確定要清除所有本地資料嗎？')) { localStorage.clear(); window.location.reload(); } }} className="w-full py-3 bg-white border border-red-200 text-red-600 font-bold rounded-lg hover:bg-red-50 transition">⚠️ 強制清除資料並重設</button>
                    </div>
                </div>
            </div>
        );
    }

    const ActiveForm = FORM_COMPONENT_BY_TAB[activeTab] || null;
    const ActiveContent = CONTENT_COMPONENT_BY_TAB[activeTab] || TabContent;

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
            {configWarnings.length > 0 && (
                <div className="bg-amber-50 border-b border-amber-200 p-3 shadow-sm">
                    <div className="container mx-auto px-4 flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                        <div className="flex-1 text-xs font-bold text-amber-800">
                            系統配置未完成：<span className="font-normal ml-1">{configWarnings.join(' ')}</span>
                        </div>
                        <button onClick={() => setConfigWarnings([])} className="text-amber-400 hover:text-amber-600">&times;</button>
                    </div>
                </div>
            )}

            <div className="max-w-5xl mx-auto p-4 md:p-8">
                <AppHeader />
                <Instructions />
                <Dashboard />
                <SearchFilterBar />

                {ActiveForm ? <ActiveForm /> : null}

                <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="hidden md:flex border-b border-gray-200 p-1 bg-slate-50/50">
                        {TABS.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex-1 py-3 px-3 font-bold text-sm rounded-t-lg transition-colors ${activeTab === tab.key ? 'bg-white text-indigo-700 border-b-2 border-indigo-500 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <div className="p-4 md:p-6 bg-white min-h-[400px]">
                        <ActiveContent />
                    </div>
                </div>

                <footer className="mt-12 text-center text-sm text-gray-400 pb-4 md:pb-8 hidden md:block">
                    &copy; {new Date().getFullYear()} Travel Itinerary Planner. Data stored locally.
                </footer>
            </div>
            <BottomNav TABS={TABS} activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>
    );
}

export default function App() {
    return (
        <AppProvider>
            <AppContent />
        </AppProvider>
    );
}
