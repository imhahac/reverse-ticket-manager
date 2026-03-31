import React, { createContext, useContext, useMemo } from 'react';
import { useUIContext } from './UIContext';
import { useDataContext } from './DataContext';
import { useFilteredItems } from '../hooks/useFilteredItems';
import { useDecoratedTrips } from '../hooks/useDecoratedTrips';
import { useItinerary } from '../hooks/useItinerary';
import { applyTripOverrides } from '../utils/tripOverrides';

const FilterContext = createContext();

export function FilterProvider({ children }) {
    const { searchTerm, filterStatus, selectedTripIdForMap } = useUIContext();
    const { 
        tickets, tripLabels, rawHotels, activities, trips, tripOverrides 
    } = useDataContext();

    // 1. 應用手動重組 (Overrides)
    const displayTrips = useMemo(() => applyTripOverrides(trips, tripOverrides), [trips, tripOverrides]);

    // 2. 裝飾行程 (計算費用、安全性檢查)
    const {
        decoratedTrips, totalPriceTWD, totalHotelTWD, totalActivityTWD,
        pastCostTWD, futureCostTWD, totalTripDays, sunkCostTWD,
        renderError, safeTickets, safeHotels, safeActivities
    } = useDecoratedTrips(displayTrips, tickets, rawHotels, activities);

    // 3. 建立完整時間軸資料
    const itinerary = useItinerary(
        Array.isArray(decoratedTrips) ? decoratedTrips : [],
        Array.isArray(rawHotels) ? rawHotels : [],
        Array.isArray(activities) ? activities : []
    );

    // 4. 執行搜尋與狀態篩選
    const filteredTickets = useFilteredItems(safeTickets, searchTerm, filterStatus, 'tickets');
    const filteredHotels = useFilteredItems(safeHotels, searchTerm, filterStatus, 'hotels');
    const filteredActivities = useFilteredItems(safeActivities, searchTerm, filterStatus, 'activities');
    const filteredItinerary = useFilteredItems(itinerary, searchTerm, filterStatus, 'itinerary', tripLabels);

    // 5. 地圖專用過濾
    const itineraryForMap = useMemo(() => {
        if (selectedTripIdForMap) return filteredItinerary.filter(trip => trip.id === selectedTripIdForMap);
        return filteredItinerary;
    }, [filteredItinerary, selectedTripIdForMap]);

    const hotelsForMap = useMemo(() => {
        if (selectedTripIdForMap && itineraryForMap.length > 0) {
            const tripHotelIds = new Set((itineraryForMap[0].matchedHotels ?? []).map(h => h.id));
            return filteredHotels.filter(hotel => tripHotelIds.has(hotel.id));
        }
        return filteredHotels;
    }, [filteredHotels, selectedTripIdForMap, itineraryForMap]);

    const value = {
        displayTrips,
        decoratedTrips,
        totalPriceTWD, totalHotelTWD, totalActivityTWD,
        pastCostTWD, futureCostTWD, totalTripDays, sunkCostTWD,
        renderError,
        filteredTickets, filteredHotels, filteredActivities, filteredItinerary,
        itineraryForMap, hotelsForMap
    };

    return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilterContext() {
    return useContext(FilterContext);
}
