/**
 * TrekContext.jsx
 * TREK-Lite 全域旅程與規劃狀態中心
 * 負責 IndexedDB 資料響應式同步、Trip 切換、以及舊版外站票無縫遷移
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { tripRepo, reservationRepo, dayPlanRepo } from '../services/db';
import { runLegacyMigration } from '../services/migration/legacyMigration';
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

    const refreshTrips = useCallback(async (preferredTripId = null) => {
        try {
            const allTrips = await tripRepo.getAll();
            allTrips.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
            setTrips(allTrips);

            const targetId = preferredTripId || activeTripId || allTrips[0]?.id || null;
            setActiveTripId(targetId);

            const selected = allTrips.find(t => t.id === targetId) || allTrips[0] || null;
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
    }, [activeTripId]);

    // 啟動時執行平滑遷移並載入旅程
    useEffect(() => {
        let isMounted = true;
        async function init() {
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

    const selectTrip = useCallback((tripId) => {
        refreshTrips(tripId);
    }, [refreshTrips]);

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

    const value = {
        trips,
        activeTripId,
        activeTrip,
        reservations,
        dayPlans,
        isLoading,
        viewMode,
        setViewMode,
        selectTrip,
        createTrip,
        updateTrip,
        deleteTrip,
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
