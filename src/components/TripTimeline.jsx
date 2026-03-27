/**
 * TripTimeline.jsx ── 實際飛行配對 Timeline 元件
 */
import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { 
    Clock, Plane, Hotel, Ticket, CheckCircle, X, LayoutList
} from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import TripCard from './TripCard';

export default function TripTimeline({
    trips,
    tripLabels,
    onUpdateLabel,
    overrideState,
    onRemoveSegment,
    onRestoreSegment,
    onMoveSegmentToTrip,
    onSelectHotelForMap, 
    onSelectTripForMap, 
    onClearAllOverrides,
}) {
    const [editingLabelId, setEditingLabelId] = useState(null);
    const [editLabelValue, setEditLabelValue] = useState('');
    const [dragOverTripId, setDragOverTripId] = useState(null);
    
    // ── 視圖狀態（持久化） ──
    const [showFuture, setShowFuture] = useLocalStorage('timeline-show-future', true);
    const [showPast,   setShowPast]   = useLocalStorage('timeline-show-past', true);
    const [viewMode,   setViewMode]   = useLocalStorage('timeline-view-mode', 'time'); // 'time' or 'category'

    const [displayOptions, setDisplayOptions] = useLocalStorage('timeline-display-options', {
        flights: true,
        hotels: true,
        activities: true,
    });

    const tripIdOptions = useMemo(() => (trips || []).map(t => t.id), [trips]);
    const hasOverrides = Boolean(
        Object.keys(overrideState?.segTripId || {}).length ||
        (overrideState?.removedSegIds || []).length
    );

    const toggleOption = (option) => {
        setDisplayOptions(prev => ({ ...prev, [option]: !prev[option] }));
    };

    const displayOptionsConfig = [
        { key: 'flights',    label: '航班', icon: Plane },
        { key: 'hotels',     label: '住宿', icon: Hotel },
        { key: 'activities', label: '票卷', icon: Ticket },
    ];

    const getOptionClass = (key) => {
        return displayOptions[key]
            ? 'bg-white text-indigo-700 shadow-sm'
            : 'bg-transparent text-slate-500 hover:bg-slate-200/50 hover:text-slate-700';
    };

    const futureTrips = (trips || []).filter(t => !t.isPast);
    const pastTrips   = (trips || []).filter(t =>  t.isPast);

    const handleSegDragStart = (e, segId) => {
        try {
            e.dataTransfer.setData('text/plain', segId);
            e.dataTransfer.effectAllowed = 'move';
        } catch { /* ignore */ }
    };

    const handleTripDragOver = (e, tripId) => {
        e.preventDefault();
        setDragOverTripId(tripId);
        try { e.dataTransfer.dropEffect = 'move'; } catch { /* ignore */ }
    };

    const handleTripDrop = (e, tripId) => {
        e.preventDefault();
        setDragOverTripId(null);
        const segId = e.dataTransfer.getData('text/plain');
        if (segId) onMoveSegmentToTrip?.(segId, tripId);
    };

    const getDepartDate = (seg) => {
        if (!seg?.date || !seg?.time) return null;
        const d = new Date(`${seg.date}T${seg.time}:00`);
        return isNaN(d.getTime()) ? null : d;
    };

    const getArrivalDate = (seg) => {
        if (seg?.arrivalDate && seg?.arrivalTime) {
            const d = new Date(`${seg.arrivalDate}T${seg.arrivalTime}:00`);
            if (!isNaN(d.getTime())) return d;
        }
        const depart = getDepartDate(seg);
        return depart ? new Date(depart.getTime() + 2 * 60 * 60 * 1000) : null;
    };

    const formatDuration = (ms) => {
        const totalMin = Math.round(ms / 60000);
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        if (h <= 0) return `${m} 分`;
        if (m === 0) return `${h} 小時`;
        return `${h} 小時 ${m} 分`;
    };

    const handleStartEditing = (tripId, currentLabel) => {
        setEditingLabelId(tripId);
        setEditLabelValue(currentLabel || '');
    };

    const handleSaveLabel = (tripId) => {
        onUpdateLabel(tripId, editLabelValue);
        setEditingLabelId(null);
    };

    const handleCancelEditing = () => {
        setEditingLabelId(null);
        setEditLabelValue('');
    };

    const sharedCardProps = {
        tripLabels,
        tripIdOptions,
        onRemoveSegment,
        onMoveSegmentToTrip,
        editingLabelId,
        editLabelValue,
        setEditLabelValue,
        onStartEditing:   handleStartEditing,
        onSaveLabel:      handleSaveLabel,
        onCancelEditing:  handleCancelEditing,
        dragOverTripId,
        setDragOverTripId,
        onSegDragStart:   handleSegDragStart,
        onTripDragOver:   handleTripDragOver,
        onTripDrop:       handleTripDrop,
        displayOptions: { ...displayOptions, viewMode }, 
        onSelectHotelForMap, 
        onSelectTripForMap, 
        getDepartDate,
        getArrivalDate,
        formatDuration,
    };

    if (!trips || trips.length === 0) {
        return (
            <div className="p-12 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                尚無完整的配對行程
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {hasOverrides && (
                <div className="flex justify-end">
                    <button type="button" onClick={onClearAllOverrides} className="text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600">
                        清除手動重組
                    </button>
                </div>
            )}

            {/* 視圖與篩選按鈕列 */}
            <div className="bg-white/80 backdrop-blur-md sticky top-2 z-30 shadow-md border border-indigo-100 p-2 rounded-2xl flex flex-col md:flex-row items-center gap-3">
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-full md:w-fit shrink-0">
                    <button
                        onClick={() => setViewMode('time')}
                        className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'time' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Clock className="w-4 h-4" /> 時間軸
                    </button>
                    <button
                        onClick={() => setViewMode('category')}
                        className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'category' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <LayoutList className="w-4 h-4" /> 類別分組
                    </button>
                </div>
                <div className="h-6 w-px bg-slate-200 hidden md:block" />
                <div className="flex flex-1 items-center gap-1 w-full overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
                    {displayOptionsConfig.map(({ key, label, icon: Icon }) => (
                        <button
                            key={key}
                            onClick={() => toggleOption(key)}
                            className={`whitespace-nowrap flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${getOptionClass(key)}`}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            <span>{label}</span>
                            {displayOptions[key] ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <X className="w-3.5 h-3.5 text-slate-300" />}
                        </button>
                    ))}
                </div>
            </div>

            {/* 行程列表 */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-slate-600">未來行程 ({futureTrips.length})</h3>
                    <button type="button" onClick={() => setShowFuture(v => !v)} className="text-xs font-bold text-indigo-600 hover:text-indigo-800">{showFuture ? '收合' : '展開'}</button>
                </div>
                {showFuture && futureTrips.map((trip, index) => <TripCard key={trip.id} trip={trip} index={index} {...sharedCardProps} />)}
            </div>

            <div className="pt-6 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-slate-400">歷史行程 ({pastTrips.length})</h3>
                    <button type="button" onClick={() => setShowPast(v => !v)} className="text-xs font-bold text-slate-400 hover:text-slate-600">{showPast ? '收合' : '展開'}</button>
                </div>
                {showPast && pastTrips.map((trip, index) => <TripCard key={trip.id} trip={trip} index={futureTrips.length + index} {...sharedCardProps} />)}
            </div>
        </div>
    );
}

TripTimeline.propTypes = {
    trips: PropTypes.array,
    tripLabels: PropTypes.object,
    onUpdateLabel: PropTypes.func,
    overrideState: PropTypes.object,
    onRemoveSegment: PropTypes.func,
    onRestoreSegment: PropTypes.func,
    onMoveSegmentToTrip: PropTypes.func,
    onSelectHotelForMap: PropTypes.func,
    onSelectTripForMap: PropTypes.func,
    onClearAllOverrides: PropTypes.func,
};
