/**
 * TrekContext.jsx
 * TREK-Lite 全域旅程與規劃狀態中心
 * 負責 IndexedDB 資料響應式同步、Trip 切換、以及舊版外站票無縫遷移
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { tripRepo, reservationRepo, dayPlanRepo } from '../services/db';
import { runLegacyMigration } from '../services/migration/legacyMigration';
import { sortTripsByTime, isTripArchivedOrEnded } from '../services/trips/tripStatusService';
import { fetchShareSnapshot } from '../services/shareService';
import { logger } from '../utils/logger';

const TrekContext = createContext(null);

export function TrekProvider({ children }) {
    const [trips, setTrips] = useState([]);
    const [activeTripId, setActiveTripId] = useState(null);
    const [activeTrip, setActiveTrip] = useState(null);
    const [reservations, setReservations] = useState([]);
    const [dayPlans, setDayPlans] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState('split'); // 'split' | 'planner-only' | 'map-only'
    const [sharedTripData, setSharedTripData] = useState(null);

    const refreshTrips = useCallback(async (preferredTripId = null) => {
        try {
            const allTrips = await tripRepo.getAll();
            const { activeTrips, sortedTrips } = sortTripsByTime(allTrips);
            setTrips(sortedTrips);

            // 若目前為分享預覽模式，維持分享旅程
            if (sharedTripData?.trip && !preferredTripId) {
                return;
            }

            // 優先選擇指定旅程，否則優先選取進行中/即將出發之旅程
            const defaultTarget = activeTrips[0]?.id || sortedTrips[0]?.id || null;
            const targetId = preferredTripId || activeTripId || defaultTarget;
            setActiveTripId(targetId);

            const selected = sortedTrips.find(t => t.id === targetId) || sortedTrips[0] || null;
            setActiveTrip(selected);

            if (selected) {
                const resList = await reservationRepo.getByTrip(selected.id);
                setReservations(resList);

                const plans = await dayPlanRepo.getByTrip(selected.id);
                plans.sort((a, b) => (a.dayIndex || 0) - (b.dayIndex || 0));
                setDayPlans(plans);
            } else {
                setReservations([]);
                setDayPlans([]);
            }
        } catch (err) {
            logger.error('Failed to load trips from IndexedDB:', err);
        } finally {
            setIsLoading(false);
        }
    }, [activeTripId, sharedTripData]);

    // 啟動時檢查是否含有 ?view= 分享連結，或執行平滑遷移並載入旅程
    useEffect(() => {
        let isMounted = true;
        async function init() {
            // 1. 優先檢查網址是否有 ?view=<UUID> 分享行程識別碼
            const queryParams = new URLSearchParams(window.location.search);
            const viewId = queryParams.get('view');

            if (viewId) {
                const toastId = toast.loading('正在載入分享的行程快照...');
                try {
                    const normalized = await fetchShareSnapshot(viewId);
                    if (isMounted) {
                        setSharedTripData(normalized);
                        setActiveTrip(normalized.trip);
                        setActiveTripId(normalized.trip.id);
                        setReservations(normalized.reservations || []);
                        setDayPlans(normalized.dayPlans || []);
                        setIsLoading(false);
                        toast.dismiss(toastId);
                        toast.info(`👀 正在檢視唯讀分享行程：${normalized.trip.title}`, {
                            description: '可點擊上方橫幅「📥 匯入至我的旅程」進行儲存與編輯。',
                            duration: 6000
                        });

                        // 同步載入本機旅程清單供下拉切換
                        const allTrips = await tripRepo.getAll();
                        const { sortedTrips } = sortTripsByTime(allTrips);
                        setTrips(sortedTrips);
                        return;
                    }
                } catch (err) {
                    toast.dismiss(toastId);
                    toast.error('無法載入分享行程', {
                        description: err.message || '該分享連結可能已過期或不存在，已為您載入本地旅程。',
                        duration: 6000
                    });
                }
            }

            // 2. 常規模式：平滑遷移並載入本地 IndexedDB 旅程
            try {
                const migrationRes = await runLegacyMigration();
                if (migrationRes.migrated && isMounted) {
                    toast.success(`✨ 舊版外站票已無損升級至全新旅程 (${migrationRes.tripsCount} 趟旅程)`);
                }
            } catch (err) {
                logger.error('Migration error:', err);
            }
            if (isMounted) {
                await refreshTrips();
            }
        }
        init();
        return () => { isMounted = false; };
    }, [refreshTrips]);

    const exitSharedView = useCallback(() => {
        const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
        setSharedTripData(null);
        refreshTrips();
        toast.info('已退出唯讀分享模式，回到本地旅程');
    }, [refreshTrips]);

    const importSharedTripToLocal = useCallback(async () => {
        if (!sharedTripData?.trip) return;
        const toastId = toast.loading('正在將分享行程匯入至本地旅程庫...');
        try {
            const rawTrip = sharedTripData.trip;
            const newTripId = `trip_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            const clonedTrip = {
                ...rawTrip,
                id: newTripId,
                title: `${rawTrip.title.replace(/^分享的\s*/, '')} (匯入副本)`,
                isShared: false,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            await tripRepo.save(clonedTrip);

            // 儲存預訂項目
            if (Array.isArray(sharedTripData.reservations)) {
                for (const res of sharedTripData.reservations) {
                    await reservationRepo.save({
                        ...res,
                        id: `res_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                        tripId: newTripId
                    });
                }
            }

            // 儲存日程安排
            if (Array.isArray(sharedTripData.dayPlans)) {
                for (const plan of sharedTripData.dayPlans) {
                    await dayPlanRepo.save({
                        ...plan,
                        id: `day_${newTripId}_${plan.dayIndex}`,
                        tripId: newTripId
                    });
                }
            }

            // 清除 URL 參數
            const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.replaceState({ path: cleanUrl }, '', cleanUrl);

            setSharedTripData(null);
            await refreshTrips(newTripId);

            toast.success(`✨ 已成功匯入「${clonedTrip.title}」至您的旅程庫！`, {
                id: toastId,
                description: '您現在可以自由編輯與規劃這趟旅程。'
            });
        } catch (err) {
            toast.error('匯入分享行程失敗', { id: toastId, description: err.message });
        }
    }, [sharedTripData, refreshTrips]);

    const selectTrip = useCallback((tripId) => {
        if (sharedTripData) {
            const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
            setSharedTripData(null);
        }
        refreshTrips(tripId);
    }, [sharedTripData, refreshTrips]);

    const createTrip = useCallback(async (tripData) => {
        const id = `trip_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const newTrip = {
            id,
            title: tripData.title || '新旅程',
            startDate: tripData.startDate || new Date().toISOString().slice(0, 10),
            endDate: tripData.endDate || new Date().toISOString().slice(0, 10),
            baseCurrency: tripData.baseCurrency || 'TWD',
            budget: Number(tripData.budget) || 0,
            status: 'planning',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        await tripRepo.save(newTrip);
        toast.success(`已建立旅程：${newTrip.title}`);
        await refreshTrips(id);
        return newTrip;
    }, [refreshTrips]);

    const updateTrip = useCallback(async (tripData) => {
        if (!tripData.id) return;
        await tripRepo.save({
            ...tripData,
            updatedAt: Date.now()
        });
        toast.success('旅程資訊已儲存');
        await refreshTrips(tripData.id);
    }, [refreshTrips]);

    const deleteTrip = useCallback(async (tripId) => {
        await tripRepo.delete(tripId);
        toast.info('旅程已刪除');
        await refreshTrips();
    }, [refreshTrips]);

    const toggleArchiveTrip = useCallback(async (tripId) => {
        const target = trips.find(t => t.id === tripId);
        if (!target) return;
        const isCurrentlyArchived = isTripArchivedOrEnded(target);
        const newStatus = isCurrentlyArchived ? 'planning' : 'archived';
        await tripRepo.save({
            ...target,
            status: newStatus,
            updatedAt: Date.now()
        });
        toast.success(newStatus === 'archived' ? `已將「${target.title}」封存` : `已取消「${target.title}」的封存狀態`);
        await refreshTrips(target.id);
    }, [trips, refreshTrips]);

    const value = {
        trips,
        activeTripId,
        activeTrip,
        reservations,
        dayPlans,
        isLoading,
        viewMode,
        setViewMode,
        sharedTripData,
        isSharedView: Boolean(sharedTripData),
        importSharedTripToLocal,
        exitSharedView,
        selectTrip,
        createTrip,
        updateTrip,
        deleteTrip,
        toggleArchiveTrip,
        refreshTrips
    };

    return (
        <TrekContext.Provider value={value}>
            {children}
        </TrekContext.Provider>
    );
}

export function useTrek() {
    const ctx = useContext(TrekContext);
    if (!ctx) {
        throw new Error('useTrek must be used within a TrekProvider');
    }
    return ctx;
}

export function useOptionalTrek() {
    return useContext(TrekContext) || {};
}
