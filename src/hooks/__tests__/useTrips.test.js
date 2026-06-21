import { describe, it, expect } from 'vitest';
import { buildTripsFromTickets } from '../useTrips';

describe('buildTripsFromTickets - Nesting Diagnostics', () => {
    it('should diagnose MISSING_INBOUND when only outbound exists', () => {
        const tickets = [
            {
                id: 'ticket-1',
                type: 'oneway',
                outboundDate: '2026-07-01',
                outboundTime: '10:00',
                departRegion: 'TPE 台北',
                returnRegion: 'NRT 東京'
            }
        ];
        const { trips } = buildTripsFromTickets(tickets);
        expect(trips).toHaveLength(1);
        expect(trips[0].isComplete).toBe(false);
        expect(trips[0].incompleteReason).toBe('MISSING_INBOUND');
    });

    it('should diagnose MULTIPLE_DEPARTURES when a trip is cut off by another departure', () => {
        const tickets = [
            {
                id: 'ticket-1',
                type: 'oneway',
                outboundDate: '2026-07-01',
                outboundTime: '10:00',
                departRegion: 'TPE 台北',
                returnRegion: 'NRT 東京'
            },
            {
                id: 'ticket-2',
                type: 'oneway',
                outboundDate: '2026-07-05',
                outboundTime: '10:00',
                departRegion: 'TPE 台北',
                returnRegion: 'OSA 大阪'
            }
        ];
        const { trips } = buildTripsFromTickets(tickets);
        expect(trips).toHaveLength(2);
        expect(trips[0].isComplete).toBe(false);
        expect(trips[0].incompleteReason).toBe('MULTIPLE_DEPARTURES');
        expect(trips[1].isComplete).toBe(false);
        expect(trips[1].incompleteReason).toBe('MISSING_INBOUND');
    });

    it('should diagnose ORPHAN_INBOUND when only inbound flight is present', () => {
        const tickets = [
            {
                id: 'ticket-1',
                type: 'oneway',
                outboundDate: '2026-07-05',
                outboundTime: '15:00',
                departRegion: 'NRT 東京',
                returnRegion: 'TPE 台北'
            }
        ];
        const { trips } = buildTripsFromTickets(tickets);
        expect(trips).toHaveLength(1);
        expect(trips[0].isComplete).toBe(false);
        expect(trips[0].incompleteReason).toBe('ORPHAN_INBOUND');
    });
});
