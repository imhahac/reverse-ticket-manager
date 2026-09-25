/**
 * SplitPlannerView.jsx
 * 現代化雙欄響應式行程規劃中心 (Master-Detail Split Layout)
 * 左欄：日程時間軸 (Day Plans / 景點清單 / 備忘錄 / 預訂清單)
 * 右欄：即時向量互動地圖 (MapLibre / Leaflet Viewport)
 */

import React, { useState } from 'react';
import { 
    Calendar, 
    MapPin, 
    Plus, 
    FileText, 
    Ticket, 
    Utensils, 
    Hotel, 
    Plane, 
    Maximize2, 
    Minimize2,
    Map as MapIcon,
    ListFilter
} from 'lucide-react';
import { useTrek } from '../../contexts/TrekContext';
import DayPlanTimeline from './DayPlanTimeline';
import MapLibreView from './MapLibreView';
import ReservationManager from './ReservationManager';

export default function SplitPlannerView() {
    const { activeTrip, reservations, dayPlans, viewMode, setViewMode } = useTrek();
    const [subTab, setSubTab] = useState('timeline'); // 'timeline' | 'reservations'
    const [mobileActiveView, setMobileActiveView] = useState('planner'); // 'planner' | 'map'
    const [selectedPlaces, setSelectedPlaces] = useState([]);
    const [routeGeometry, setRouteGeometry] = useState(null);

    if (!activeTrip) {
        return (
            <div className="p-12 text-center text-slate-500">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-base font-semibold">尚未選擇旅程</p>
                <p className="text-xs text-slate-400 mt-1">請於上方導航列選擇或建立一趟新旅程</p>
            </div>
        );
    }

    const showPlanner = viewMode !== 'map-only';
    const showMap = viewMode !== 'planner-only';

    return (
        <div className="relative">
            {/* Mobile View Toggle Bar (僅在手機螢幕顯示) */}
            <div className="lg:hidden flex mb-4 bg-slate-200/80 p-1 rounded-xl text-xs font-bold text-slate-600">
                <button
                    onClick={() => setMobileActiveView('planner')}
                    className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${mobileActiveView === 'planner' ? 'bg-white text-indigo-700 shadow-sm' : ''}`}
                >
                    <ListFilter className="w-3.5 h-3.5" />
                    <span>日程與預訂</span>
                </button>
                <button
                    onClick={() => setMobileActiveView('map')}
                    className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${mobileActiveView === 'map' ? 'bg-white text-indigo-700 shadow-sm' : ''}`}
                >
                    <MapIcon className="w-3.5 h-3.5" />
                    <span>地圖模式</span>
                </button>
            </div>

            {/* Desktop & Tablet Split View Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* ── Left Column: Master Timeline / Planner (佔 7 欄或 12 欄) ── */}
                {showPlanner && (
                    <div className={`space-y-4 ${showMap ? 'lg:col-span-7 xl:col-span-6' : 'lg:col-span-12'} ${mobileActiveView !== 'planner' ? 'hidden lg:block' : 'block'}`}>
                        {/* Trip Summary Card */}
                        <div className="bg-gradient-to-r from-indigo-900 to-slate-900 rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
                            <div className="relative z-10">
                                <div className="flex items-center justify-between gap-3 mb-1">
                                    <h2 className="text-xl font-black tracking-wide truncate">{activeTrip.title}</h2>
                                    <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-500/30 text-indigo-200 font-bold border border-indigo-400/30">
                                        {activeTrip.status === 'completed' ? '已完成' : '規劃中'}
                                    </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-4 text-xs text-indigo-200 font-medium mt-2">
                                    <span className="flex items-center gap-1">
                                        <Calendar className="w-3.5 h-3.5 text-indigo-300" />
                                        {activeTrip.startDate} ~ {activeTrip.endDate}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Ticket className="w-3.5 h-3.5 text-emerald-300" />
                                        {reservations.length} 個預訂項目
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Sub-tab Navigation */}
                        <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setSubTab('timeline')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${subTab === 'timeline' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100 border border-gray-200'}`}
                                >
                                    <Calendar className="w-3.5 h-3.5" />
                                    <span>每日行程 (Timeline)</span>
                                </button>
                                <button
                                    onClick={() => setSubTab('reservations')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${subTab === 'reservations' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100 border border-gray-200'}`}
                                >
                                    <Ticket className="w-3.5 h-3.5" />
                                    <span>預訂總覽 ({reservations.length})</span>
                                </button>
                            </div>
                        </div>

                        {/* Main SubTab Content */}
                        {subTab === 'timeline' ? (
                            <DayPlanTimeline 
                                onSelectDayPlaces={setSelectedPlaces} 
                                onRouteCalculated={setRouteGeometry} 
                            />
                        ) : (
                            <ReservationManager />
                        )}
                    </div>
                )}

                {/* ── Right Column: Interactive Map Viewport (佔 5 欄或 12 欄) ── */}
                {showMap && (
                    <div className={`sticky top-20 ${showPlanner ? 'lg:col-span-5 xl:col-span-6' : 'lg:col-span-12'} ${mobileActiveView !== 'map' ? 'hidden lg:block' : 'block'}`}>
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-6rem)]">
                            <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-slate-50/70 text-xs font-bold text-slate-700">
                                <span className="flex items-center gap-1.5">
                                    <MapPin className="w-4 h-4 text-indigo-600" />
                                    <span>互動地圖視窗 (OpenFreeMap 向量圖資)</span>
                                </span>
                                <button
                                    onClick={() => setViewMode(viewMode === 'map-only' ? 'split' : 'map-only')}
                                    className="p-1 rounded hover:bg-slate-200 text-slate-500 transition"
                                    title={viewMode === 'map-only' ? '恢復雙欄' : '全螢幕地圖'}
                                >
                                    {viewMode === 'map-only' ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                                </button>
                            </div>
                            <div className="flex-1 w-full relative">
                                <MapLibreView places={selectedPlaces} routeGeometry={routeGeometry} />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
