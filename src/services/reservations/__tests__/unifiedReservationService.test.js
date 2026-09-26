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

    it('should ignore items outside trip date range', () => {
        const outTickets = [
            {
                id: 't-out',
                segments: [{ id: 's-out', flightNo: 'CI100', date: '2025-01-01' }]
            }
        ];
        const unified = getUnifiedReservations(mockTrip, [], outTickets, [], []);
        expect(unified.length).toBe(0);
    });
});
