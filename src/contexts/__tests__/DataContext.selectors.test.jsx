import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('../../hooks/useLocalStorage', () => ({
    useLocalStorage: (key, initialValue) => [initialValue, vi.fn()],
}));

vi.mock('../../hooks/useExchangeRates', () => ({
    useExchangeRates: () => ({ exchangeRates: { JPY: 0.21, USD: 32 } }),
}));

vi.mock('../../hooks/useTrips', () => ({
    useTrips: () => ({
        segments: [{ id: 'seg-1' }],
        trips: [{ id: 'trip-1' }],
    }),
}));

vi.mock('../../hooks/useTripOverrides', () => ({
    useTripOverrides: () => ({
        overrides: { version: 1, removedSegIds: [] },
        removeSegment: vi.fn(),
        restoreSegment: vi.fn(),
        moveSegmentToTrip: vi.fn(),
        clearAllOverrides: vi.fn(),
    }),
}));

vi.mock('../../features/hotels/hooks/useHotels', () => ({
    useHotels: () => ({
        hotels: [{ id: 'h-1' }],
        rawHotels: [{ id: 'h-1' }],
        addHotel: vi.fn(),
        updateHotel: vi.fn(),
        deleteHotel: vi.fn(),
        updateHotelCalendarIds: vi.fn(),
        setHotels: vi.fn(),
    }),
}));

vi.mock('../../hooks/useActivities', () => ({
    useActivities: () => ({
        activities: [{ id: 'a-1' }],
        setActivities: vi.fn(),
        addActivity: vi.fn(),
        updateActivity: vi.fn(),
        deleteActivity: vi.fn(),
        updateActivityCalendarId: vi.fn(),
    }),
}));

vi.mock('../../hooks/useEntityManager', () => ({
    useEntityManager: ({ itemName }) => {
        if (itemName === '飯店') {
            return {
                editingItem: { id: 'edit-h' },
                handleSave: vi.fn(),
                handleEdit: vi.fn(),
                handleCancelEdit: vi.fn(),
                handleDelete: vi.fn(),
                isSaving: false,
            };
        }
        return {
            editingItem: { id: 'edit-a' },
            handleSave: vi.fn(),
            handleEdit: vi.fn(),
            handleCancelEdit: vi.fn(),
            handleDelete: vi.fn(),
            isSaving: false,
        };
    },
}));

vi.mock('../../utils/importExportUtils', () => ({
    exportData: vi.fn(),
    importData: vi.fn(),
}));

vi.mock('sonner', () => ({
    toast: Object.assign(vi.fn(), {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        loading: vi.fn(),
        dismiss: vi.fn(),
        info: vi.fn(),
    }),
}));

import {
    DataProvider,
    useDataContext,
    useTicketDataContext,
    useHotelDataContext,
    useActivityDataContext,
    useOverrideDataContext,
    useSystemDataContext,
} from '../DataContext';

function Probe() {
    const all = useDataContext();
    const ticket = useTicketDataContext();
    const hotel = useHotelDataContext();
    const activity = useActivityDataContext();
    const override = useOverrideDataContext();
    const system = useSystemDataContext();

    return (
        <pre
            data-testid="ctx"
            data-all={JSON.stringify({
                hasTicketDomain: Boolean(all.ticketDomain),
                hasHotelDomain: Boolean(all.hotelDomain),
                hasActivityDomain: Boolean(all.activityDomain),
                hasOverrideDomain: Boolean(all.overrideDomain),
                hasSystemDomain: Boolean(all.systemDomain),
                flatTickets: Array.isArray(all.tickets),
                flatTrips: Array.isArray(all.trips),
                flatHotels: Array.isArray(all.hotels),
                flatActivities: Array.isArray(all.activities),
            })}
            data-ticket={JSON.stringify({
                ticketCount: ticket.tickets?.length || 0,
                tripCount: ticket.trips?.length || 0,
            })}
            data-hotel={JSON.stringify({
                hotelCount: hotel.hotels?.length || 0,
            })}
            data-activity={JSON.stringify({
                activityCount: activity.activities?.length || 0,
            })}
            data-override={JSON.stringify({
                hasOverrides: Boolean(override.tripOverrides),
            })}
            data-system={JSON.stringify({
                hasExchangeRates: Boolean(system.exchangeRates),
            })}
        />
    );
}

describe('DataContext selectors', () => {
    it('exposes both structured domains and backward-compatible flat fields', () => {
        const { getByTestId } = render(
            <DataProvider>
                <Probe />
            </DataProvider>
        );

        const node = getByTestId('ctx');
        const all = JSON.parse(node.dataset.all || '{}');
        const ticket = JSON.parse(node.dataset.ticket || '{}');
        const hotel = JSON.parse(node.dataset.hotel || '{}');
        const activity = JSON.parse(node.dataset.activity || '{}');
        const override = JSON.parse(node.dataset.override || '{}');
        const system = JSON.parse(node.dataset.system || '{}');

        expect(all.hasTicketDomain).toBe(true);
        expect(all.hasHotelDomain).toBe(true);
        expect(all.hasActivityDomain).toBe(true);
        expect(all.hasOverrideDomain).toBe(true);
        expect(all.hasSystemDomain).toBe(true);

        expect(all.flatTickets).toBe(true);
        expect(all.flatTrips).toBe(true);
        expect(all.flatHotels).toBe(true);
        expect(all.flatActivities).toBe(true);

        expect(ticket.ticketCount).toBe(0);
        expect(ticket.tripCount).toBe(1);
        expect(hotel.hotelCount).toBe(1);
        expect(activity.activityCount).toBe(1);
        expect(override.hasOverrides).toBe(true);
        expect(system.hasExchangeRates).toBe(true);
    });
});
