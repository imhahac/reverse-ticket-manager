import React, { createContext, useContext, useState, useRef } from 'react';
import { validateConfig } from '../constants/config';

const UIContext = createContext();

export function UIProvider({ children }) {
    const [activeTab, setActiveTab] = useState('timeline');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [configWarnings, setConfigWarnings] = useState([]);
    
    // Map selection states
    const [selectedHotelIdForMap, setSelectedHotelIdForMap] = useState(null);
    const [selectedTripIdForMap, setSelectedTripIdForMap] = useState(null);

    const fileInputRef = useRef(null);

    React.useEffect(() => {
        const warnings = validateConfig();
        setConfigWarnings(warnings);
    }, []);

    const handleSelectTripForMap = (tripId) => {
        setSelectedHotelIdForMap(null);
        setSelectedTripIdForMap(tripId);
        setActiveTab('map');
    };
    
    const handleSelectHotelForMap = (hotelId, tripId) => {
        setSelectedHotelIdForMap(hotelId);
        handleSelectTripForMap(tripId);
    };

    const handleClearSelectedTripForMap = () => {
        setSelectedTripIdForMap(null);
    };

    const value = {
        activeTab, setActiveTab,
        searchTerm, setSearchTerm,
        filterStatus, setFilterStatus,
        configWarnings, setConfigWarnings,
        selectedHotelIdForMap, setSelectedHotelIdForMap,
        selectedTripIdForMap, setSelectedTripIdForMap,
        handleSelectTripForMap, handleSelectHotelForMap, handleClearSelectedTripForMap,
        fileInputRef
    };

    return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUIContext() {
    return useContext(UIContext);
}
