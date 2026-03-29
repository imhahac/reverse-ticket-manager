import React from 'react';
import TripTimeline from './TripTimeline';
import TicketList from './TicketList';
import HotelList from '../features/hotels/components/HotelList';
import ActivityList from './ActivityList';
import TripCalendar from './TripCalendar';
import TripMap from './TripMap';

import { useAppContext } from '../contexts/AppContext';

export default function TabContent() {
    const { 
        activeTab, 
        filteredItinerary, 
        tripLabels, 
        setTripLabels,
        tripOverrides,
        removeSegment,
        restoreSegment,
        moveSegmentToTrip,
        clearAllOverrides,
        handleSelectHotelForMap,
        handleSelectTripForMap,
        filteredTickets,
        handleDeleteTicket,
        handleEditTicket,
        filteredHotels,
        handleEditHotel,
        handleDeleteHotel,
        filteredActivities,
        handleEditActivity,
        handleDeleteActivity,
        itineraryForMap,
        hotelsForMap,
        handleClearSelectedTripForMap,
        selectedHotelIdForMap,
        selectedTripIdForMap
    } = useAppContext();

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
