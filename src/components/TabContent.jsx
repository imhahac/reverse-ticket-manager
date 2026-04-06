import React from 'react';
import TripTimeline from './TripTimeline';
import TicketList from './TicketList';
import HotelList from '../features/hotels/components/HotelList';
import ActivityList from './ActivityList';
import TripCalendar from './TripCalendar';
import TripMap from './TripMap';

import {
    useActivityDataContext,
    useHotelDataContext,
    useOverrideDataContext,
    useTicketDataContext,
} from '../contexts/DataContext';
import { useFilterContext } from '../contexts/FilterContext';
import { useUIContext } from '../contexts/UIContext';

export default function TabContent() {
    const { 
        activeTab,
        handleSelectHotelForMap,
        handleSelectTripForMap,
        handleClearSelectedTripForMap,
        selectedHotelIdForMap,
        selectedTripIdForMap
    } = useUIContext();

    const {
        filteredItinerary,
        filteredTickets,
        filteredHotels,
        filteredActivities,
        itineraryForMap,
        hotelsForMap,
    } = useFilterContext();
    const { tripLabels, setTripLabels, handleDeleteTicket, handleEditTicket } = useTicketDataContext();
    const { handleEditHotel, handleDeleteHotel } = useHotelDataContext();
    const { handleEditActivity, handleDeleteActivity } = useActivityDataContext();
    const { tripOverrides, removeSegment, restoreSegment, moveSegmentToTrip, clearAllOverrides } = useOverrideDataContext();

    if (activeTab === 'timeline') {
        return (
            <TripTimeline
                trips={filteredItinerary}
                tripLabels={tripLabels}
                onUpdateLabel={(id, val) => setTripLabels(p => ({ ...p, [id]: val }))}
                overrideState={tripOverrides}
                onRemoveSegment={removeSegment}
                onRestoreSegment={restoreSegment}
                onMoveSegmentToTrip={moveSegmentToTrip}
                onClearAllOverrides={clearAllOverrides}
                onSelectHotelForMap={handleSelectHotelForMap}
                onSelectTripForMap={handleSelectTripForMap}
            />
        );
    }

    if (activeTab === 'list') {
        return (
            <TicketList 
                tickets={filteredTickets} 
                onDelete={handleDeleteTicket} 
                onEdit={handleEditTicket} 
            />
        );
    }

    if (activeTab === 'hotels') {
        return (
            <HotelList
                hotels={filteredHotels}
                onEdit={handleEditHotel}
                onDelete={handleDeleteHotel}
            />
        );
    }

    if (activeTab === 'activities') {
        return (
            <ActivityList
                activities={filteredActivities}
                onEdit={handleEditActivity}
                onDelete={handleDeleteActivity}
            />
        );
    }

    if (activeTab === 'calendar') {
        return <TripCalendar trips={itineraryForMap} tripLabels={tripLabels} />;
    }

    if (activeTab === 'map') {
        return (
            <TripMap
                itinerary={itineraryForMap}
                hotels={hotelsForMap}
                onClearSelectedTrip={handleClearSelectedTripForMap}
                selectedHotelId={selectedHotelIdForMap}
                selectedTripId={selectedTripIdForMap}
            />
        );
    }

    return null;
}
