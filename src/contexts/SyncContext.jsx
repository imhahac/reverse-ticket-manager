import React, { createContext, useContext } from 'react';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { useGoogleSync } from '../hooks/useGoogleSync';
import { useDataContext } from './DataContext';

export const SyncContext = createContext();

export function SyncProvider({ children }) {
    const { accessToken, accessTokenState, login, logout, trySilentRefresh } = useGoogleAuth();
    
    // 從 DataContext 取得同步所需之狀態與 setters
    const { 
        tickets, tripLabels, setTickets, setTripLabels, 
        hotels, rawHotels, setHotels, updateHotelCalendarIds,
        activities, setActivities, updateActivityCalendarId,
        segments
    } = useDataContext();

    const { isSyncing, handleSyncToDrive, handleLoadFromDrive, handleSyncToCalendar } = useGoogleSync({
        accessToken, accessTokenState, trySilentRefresh, logout,
        tickets, tripLabels, setTickets, setTripLabels,
        hotels, rawHotels,
        activities,
        segments,
        setHotels,
        setActivities,
        updateHotelCalendarIds,
        updateActivityCalendarId,
    });

    const value = {
        accessToken, accessTokenState, login, logout, trySilentRefresh,
        isSyncing, handleSyncToDrive, handleLoadFromDrive, handleSyncToCalendar
    };

    return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSyncContext() {
    return useContext(SyncContext);
}
