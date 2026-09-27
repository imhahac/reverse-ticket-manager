import { describe, it, expect } from 'vitest';
import { getUnifiedReservations } from '../unifiedReservationService';

describe('unifiedReservationService', () => {
    const mockTrip = {
        id: 'trip-1',
        title: '2026 Tokyo Legacy Marathon',
        startDate: '2026-10-16',
        endDate: '2026-10-22'
    };

    const mockTickets = [
        {
            id: 't-1',
            airline: 'China Airlines',
            priceTWD: 15000,
            paid: true,
            segments: [
                {
                    id: 's-1',
                    flightNo: 'CI222',
                    from: 'TSA',
                    to: 'HND',
                    date: '2026-10-16',
                    time: '09:00'
                }
            ]
        }
    ];

    const mockHotels = [
        {
            id: 'h-1',
            name: '東橫INN 東京日本橋馬喰町',
            checkIn: '2026-10-16',
            checkOut: '2026-10-22',
            priceTWD: 10686,
            address: 'Tokyo'
        }
    ];

    const mockActivities = [
        {
            id: 'a-1',
            title: '東京馬拉松 Expo 報到',
            date: '2026-10-17',
            category: 'voucher',
            cost: 500
        }
    ];

    it('should combine tickets, hotels and activities into unified reservations for active trip', () => {
        const unified = getUnifiedReservations(mockTrip, [], mockTickets, mockHotels, mockActivities);
        expect(unified.length).toBe(3);
        
        const flight = unified.find(u => u.type === 'flight');
        expect(flight).toBeDefined();
        expect(flight.title).toContain('CI222');
        expect(flight.sourceLabel).toBe('機票管理同步');

        const hotel = unified.find(u => u.type === 'accommodation');
        expect(hotel).toBeDefined();
        expect(hotel.title).toBe('東橫INN 東京日本橋馬喰町');

        const act = unified.find(u => u.type === 'ticket');
        expect(act).toBeDefined();
        expect(act.title).toBe('東京馬拉松 Expo 報到');
    });

    it('should correctly integrate standard tickets (outbound + inbound) into reservations', () => {
        const standardTickets = [
            {
                id: 'ticket-real-1',
                airline: 'China Airlines',
                type: 'normal',
                departRegion: 'TSA (台北松山)',
                returnRegion: 'HND (東京羽田)',
                outboundDate: '2026-10-16',
                outboundTime: '18:05',
                outboundFlightNo: 'CI222',
                inboundDate: '2026-10-22',
                inboundTime: '20:00',
                inboundFlightNo: 'CI109',
                priceTWD: 16439,
                isPaid: true
            }
        ];

        const unified = getUnifiedReservations(mockTrip, [], standardTickets, [], []);
        expect(unified.length).toBe(2);

        const outbound = unified.find(u => u.flightDetails?.flightNumber === 'CI222');
        expect(outbound).toBeDefined();
        expect(outbound.title).toContain('CI222');
        expect(outbound.title).toContain('去程');
        expect(outbound.flightDetails.from).toBe('TSA (台北松山)');
        expect(outbound.flightDetails.to).toBe('HND (東京羽田)');
        expect(outbound.sourceLabel).toBe('機票管理同步');
        expect(outbound.status).toBe('confirmed');

        const inbound = unified.find(u => u.flightDetails?.flightNumber === 'CI109');
        expect(inbound).toBeDefined();
        expect(inbound.title).toContain('CI109');
        expect(inbound.title).toContain('回程');
        expect(inbound.flightDetails.from).toBe('HND (東京羽田)');
        expect(inbound.flightDetails.to).toBe('TSA (台北松山)');
    });
});

