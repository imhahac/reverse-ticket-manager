import React from 'react';
import { MapPin, Globe } from 'lucide-react';
import { AppProvider } from './contexts/AppContext';
import { useFilterContext } from './contexts/FilterContext';
import { useUIContext } from './contexts/UIContext';
import { downloadDiagnosticDump } from './utils/diagnosticDump';

import TicketForm from './components/TicketForm';
import HotelForm from './features/hotels/components/HotelForm';
import ActivityForm from './components/ActivityForm';
import BottomNav from './components/BottomNav';
import SearchFilterBar from './components/SearchFilterBar';
import TabContent from './components/TabContent';
import CostDashboard from './components/CostDashboard';
import TrekHeader from './components/trek/TrekHeader';
import SplitPlannerView from './components/trek/SplitPlannerView';
import CostManager from './components/trek/CostManager';
import PackingAndTodoManager from './components/trek/PackingAndTodoManager';
import { useTrek, TrekProvider } from './contexts/TrekContext';

// ── Workspaces Definition (商業分組導航) ──────────────────────────────────
const WORKSPACES = [
    {
        id: 'planning',
        label: '🗺️ 行程工作台',
        defaultTab: 'planner',
        tabs: [
            { key: 'planner',      label: '⚡ 每日排程時間表' },
            { key: 'timeline',     label: '📆 旅程全景時間軸' },
            { key: 'reservations', label: '🎟️ 預訂總覽' },
            { key: 'calendar',     label: '📅 月曆視圖' },
            { key: 'map',          label: '🌐 航線地圖' },
        ]
    },
    {
        id: 'finance',
        label: '💰 財務中心',
        defaultTab: 'costs',
        tabs: [
            { key: 'costs',      label: '💰 財務總覽與記帳' },
        ]
    },
    {
        id: 'prep',
        label: '🎒 整備中心',
        defaultTab: 'packing',
        tabs: [
            { key: 'packing',    label: '🧳 行李、待辦與大檔' },
        ]
    },
    {
        id: 'tickets',
        label: '🎟️ 票券憑證',
        defaultTab: 'list',
        tabs: [
            { key: 'list',       label: '✈️ 機票管理' },
            { key: 'hotels',     label: '🏨 飯店管理' },
            { key: 'activities', label: '🎫 票券與活動' },
        ]
    }
];

// Flat tabs kept for backward compatibility
const TABS = [
    { key: 'planner',      label: '🧭 規劃工作台' },
    { key: 'costs',        label: '💰 多幣別費用' },
    { key: 'packing',      label: '🎒 行李待辦檔案' },
    { key: 'timeline',     label: '📆 行程時間軸' },
    { key: 'reservations', label: '🎟️ 預訂總覽' },
    { key: 'list',         label: '🎟️ 機票管理' },
    { key: 'hotels',       label: '🏨 飯店管理' },
    { key: 'activities',   label: '🎫 票券與活動' },
    { key: 'calendar',     label: '📅 月曆' },
    { key: 'map',          label: '🗺️ 航線地圖' },
    { key: 'analytics',    label: '📊 成本分析' },
];

const FORM_COMPONENT_BY_TAB = {
    timeline: TicketForm,
    list: TicketForm,
    hotels: HotelForm,
    activities: ActivityForm,
};

const CONTENT_COMPONENT_BY_TAB = {
    planner: SplitPlannerView,
    timeline: SplitPlannerView,
    reservations: SplitPlannerView,
    costs: CostManager,
    packing: PackingAndTodoManager,
    analytics: CostManager,
};

function AppContent() {
    const { activeTab, setActiveTab, ticketScope = 'trip', setTicketScope } = useUIContext();
    const { activeTrip } = useTrek();
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
                        <button onClick={downloadDiagnosticDump} className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition">📥 下載系統除錯診斷包 (Diagnostic Dump)</button>
                    </div>
                </div>
            </div>
        );
    }

    const currentWorkspace = WORKSPACES.find(ws => 
        ws.tabs.some(t => t.key === activeTab) || 
        (ws.id === 'finance' && activeTab === 'analytics')
    ) || WORKSPACES[0];
    const isModernTab = ['planner', 'timeline', 'reservations', 'costs', 'packing'].includes(activeTab);
    const ActiveForm = FORM_COMPONENT_BY_TAB[activeTab] || null;
    const ActiveContent = CONTENT_COMPONENT_BY_TAB[activeTab] || TabContent;

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
            <TrekHeader />
            <div className="mx-auto p-4 md:p-6 max-w-[1600px] w-full">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                    {/* Primary Workspace Navigation (商業高密度分組頁籤) */}
                    <div className="hidden md:flex items-center border-b border-slate-700 bg-slate-900 text-white px-2 pt-2 gap-1">
                        {WORKSPACES.map(ws => {
                            const isActiveWs = currentWorkspace.id === ws.id;
                            return (
                                <button
                                    key={ws.id}
                                    onClick={() => {
                                        if (!isActiveWs) setActiveTab(ws.defaultTab);
                                    }}
                                    className={`px-5 py-3 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
                                        isActiveWs
                                            ? 'bg-white text-slate-900 border-indigo-600 shadow-sm'
                                            : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                                    }`}
                                >
                                    <span>{ws.label}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-semibold ${
                                        isActiveWs ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-800 text-slate-400'
                                    }`}>
                                        {ws.tabs.length}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Secondary Sub-tab Navigation Bar (若當前工作區包含多個視圖) */}
                    {currentWorkspace.tabs.length > 1 && (
                        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200/90 bg-slate-50/80 overflow-x-auto">
                            <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-2 hidden sm:inline">
                                    視圖切換：
                                </span>
                                {currentWorkspace.tabs.map(subTab => (
                                    <button
                                        key={subTab.key}
                                        onClick={() => setActiveTab(subTab.key)}
                                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                            activeTab === subTab.key
                                                ? 'bg-slate-900 text-white shadow-xs'
                                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                                        }`}
                                    >
                                        {subTab.label}
                                    </button>
                                ))}
                            </div>

                            {/* 票券憑證專用 Scope Switcher */}
                            {currentWorkspace.id === 'tickets' && setTicketScope && (
                                <div className="flex items-center p-1 bg-slate-200/70 rounded-xl border border-slate-300/50">
                                    <button
                                        onClick={() => setTicketScope('trip')}
                                        className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                                            ticketScope === 'trip' 
                                                ? 'bg-white text-indigo-700 shadow-sm' 
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                        title={`僅顯示當前行程：${activeTrip?.title || '未選定'}`}
                                    >
                                        <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                                        <span className="max-w-[130px] truncate">{activeTrip?.title || '當前行程'}</span>
                                    </button>
                                    <button
                                        onClick={() => setTicketScope('all')}
                                        className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                                            ticketScope === 'all' 
                                                ? 'bg-white text-indigo-700 shadow-sm' 
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                        title="顯示全站所有票券憑證"
                                    >
                                        <Globe className="w-3.5 h-3.5 text-emerald-500" />
                                        <span>全域總匯</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="p-4 md:p-6 bg-white min-h-[400px]">
                        {!isModernTab && (
                            <div className="mb-6 space-y-4">
                                <SearchFilterBar />
                                {ActiveForm ? <ActiveForm /> : null}
                            </div>
                        )}
                        <ActiveContent />
                    </div>
                </div>

                <footer className="mt-12 text-center text-xs text-slate-400 pb-4 md:pb-8 hidden md:block font-medium">
                    &copy; {new Date().getFullYear()} Light Trip Plan. 智能離線旅遊規劃系統.
                </footer>
            </div>
            <BottomNav WORKSPACES={WORKSPACES} TABS={TABS} activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>
    );
}

export default function App() {
    return (
        <TrekProvider>
            <AppProvider>
                <AppContent />
            </AppProvider>
        </TrekProvider>
    );
}
