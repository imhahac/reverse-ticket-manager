import React, { createContext, useContext } from 'react';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { useGoogleSync } from '../hooks/useGoogleSync';
import { useActivityDataContext, useHotelDataContext, useTicketDataContext } from './DataContext';

export const SyncContext = createContext();

export function SyncProvider({ children }) {
    const { accessToken, accessTokenState, login, logout, isTokenExpired, trySilentRefresh } = useGoogleAuth();
    
    // 從 DataContext 取得同步所需之狀態與 setters
    const { tickets, tripLabels, setTickets, setTripLabels, tripBudgets, setTripBudgets, segments } = useTicketDataContext();
    const { hotels, rawHotels, setHotels, updateHotelCalendarIds } = useHotelDataContext();
    const { activities, setActivities, updateActivityCalendarId } = useActivityDataContext();

    const { isSyncing, handleSyncToDrive, handleLoadFromDrive, handleSyncToCalendar } = useGoogleSync({
        accessToken, accessTokenState, trySilentRefresh, isTokenExpired, logout,
        tickets, tripLabels, setTickets, setTripLabels,
        tripBudgets, setTripBudgets,
        hotels, rawHotels,
        activities,
        segments,
        setHotels,
        setActivities,
        updateHotelCalendarIds,
        updateActivityCalendarId,
    });

    const value = {
        accessToken, accessTokenState, login, logout, isTokenExpired, trySilentRefresh,
        isSyncing, handleSyncToDrive, handleLoadFromDrive, handleSyncToCalendar
    };

    return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSyncContext() {
    return useContext(SyncContext);
}
