import { describe, it, expect, vi } from 'vitest';
import { buildTripsFromTickets } from '../useTrips';

describe('useTrips -> buildTripsFromTickets', () => {
    it('returns empty results for non-array input', () => {
        expect(buildTripsFromTickets(null)).toEqual({ segments: [], trips: [] });
        expect(buildTripsFromTickets(undefined)).toEqual({ segments: [], trips: [] });
        expect(buildTripsFromTickets('not-array')).toEqual({ segments: [], trips: [] });
    });

    it('builds and closes a normal round trip (TW -> JP -> TW)', () => {
        const tickets = [
            {
                id: 't1',
                type: 'normal',
                departRegion: 'TPE (台北桃園)',
                returnRegion: 'NRT (東京成田)',
                outboundDate: '2026-04-01',
                outboundTime: '10:00',
                inboundDate: '2026-04-05',
                inboundTime: '18:00',
            },
        ];

        const { segments, trips } = buildTripsFromTickets(tickets);

        expect(segments).toHaveLength(2);
        expect(trips).toHaveLength(1);
        expect(trips[0].isComplete).toBe(true);
        expect(trips[0].outbound?.from).toContain('TPE');
        expect(trips[0].outbound?.to).toContain('NRT');
        expect(trips[0].inbound?.from).toContain('NRT');
        expect(trips[0].inbound?.to).toContain('TPE');
        expect(trips[0].isExternalOnly).toBe(false);
    });

    it('creates an incomplete trip for one-way outbound flight', () => {
        const tickets = [
            {
                id: 't2',
                type: 'oneway',
                departRegion: 'TPE (台北桃園)',
                returnRegion: 'KIX (大阪關西)',
                outboundDate: '2026-06-01',
                outboundTime: '08:00',
            },
        ];

        const { segments, trips } = buildTripsFromTickets(tickets);

        expect(segments).toHaveLength(1);
        expect(trips).toHaveLength(1);
        expect(trips[0].isComplete).toBe(false);
        expect(trips[0].outbound?.to).toContain('KIX');
        expect(trips[0].inbound).toBeNull();
    });

    it('marks external-only trip when no segment touches Taiwan', () => {
        const tickets = [
            {
                id: 't3',
                type: 'oneway',
                departRegion: 'OSA (大阪)',
                returnRegion: 'NRT (東京成田)',
                outboundDate: '2026-07-01',
                outboundTime: '07:00',
            },
        ];

        const { trips } = buildTripsFromTickets(tickets);

        expect(trips).toHaveLength(1);
        expect(trips[0].isExternalOnly).toBe(true);
    });

    it('handles reverse ticket with first segment arriving Taiwan as orphan inbound', () => {
        const tickets = [
            {
                id: 't4',
                type: 'reverse',
                departRegion: 'TPE (台北桃園)',
                returnRegion: 'NRT (東京成田)',
                outboundDate: '2026-08-01',
                outboundTime: '09:00',
            },
        ];

        const { trips } = buildTripsFromTickets(tickets);

        expect(trips).toHaveLength(1);
        expect(trips[0].outbound).toBeNull();
        expect(trips[0].inbound?.to).toContain('TPE');
        expect(trips[0].isComplete).toBe(true);
    });

    it('sorts segments by departure datetime', () => {
        const tickets = [
            {
                id: 'late',
                type: 'oneway',
                departRegion: 'TPE (台北桃園)',
                returnRegion: 'NRT (東京成田)',
                outboundDate: '2026-09-10',
                outboundTime: '10:00',
            },
            {
                id: 'early',
                type: 'oneway',
                departRegion: 'TPE (台北桃園)',
                returnRegion: 'KIX (大阪關西)',
                outboundDate: '2026-09-01',
                outboundTime: '10:00',
            },
        ];

        const { segments } = buildTripsFromTickets(tickets);

        expect(segments).toHaveLength(2);
        expect(segments[0].ticket.id).toBe('early');
        expect(segments[1].ticket.id).toBe('late');
    });

    it('falls back invalid outbound date to epoch and logs warning', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const tickets = [
            {
                id: 'bad-date',
                type: 'oneway',
                departRegion: 'TPE (台北桃園)',
                returnRegion: 'NRT (東京成田)',
                outboundDate: 'not-a-date',
                outboundTime: '10:00',
            },
        ];

        const { segments } = buildTripsFromTickets(tickets);

        expect(segments).toHaveLength(1);
        expect(segments[0].dateTime.getTime()).toBe(0);
        expect(warnSpy).toHaveBeenCalled();

        warnSpy.mockRestore();
    });
});
