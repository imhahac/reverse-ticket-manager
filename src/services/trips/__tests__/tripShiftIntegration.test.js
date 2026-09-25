import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { shiftTripDates } from '../tripShiftService';
import { getDB, STORES, tripRepo, dayPlanRepo, reservationRepo, todoRepo } from '../../db';

describe('tripShiftService - Multi-Store Cascade Integration Test', () => {
    beforeEach(async () => {
        const db = await getDB();
        const tx = db.transaction([STORES.TRIPS, STORES.DAY_PLANS, STORES.RESERVATIONS, STORES.TODOS], 'readwrite');
        await tx.objectStore(STORES.TRIPS).clear();
        await tx.objectStore(STORES.DAY_PLANS).clear();
        await tx.objectStore(STORES.RESERVATIONS).clear();
        await tx.objectStore(STORES.TODOS).clear();
        await tx.done;
    });

    it('should atomically shift trip, dayPlans, reservations, and todos by +5 days', async () => {
        const tripId = 'trip_shift_test_1';

        // 1. Seed Trip
        await tripRepo.save({
            id: tripId,
            title: '巴黎賞花行',
            startDate: '2026-06-01',
            endDate: '2026-06-05'
        });

        // 2. Seed Day Plans
        await dayPlanRepo.saveBatch([
            { id: 'dp1', tripId, dayIndex: 0, date: '2026-06-01' },
            { id: 'dp2', tripId, dayIndex: 1, date: '2026-06-02' }
        ]);

        // 3. Seed Reservations (Flight & Hotel)
        await reservationRepo.saveBatch([
            {
                id: 'res1',
                tripId,
                type: 'flight',
                departureTime: '2026-06-01T08:00:00',
                arrivalTime: '2026-06-01T20:00:00'
            },
            {
                id: 'res2',
                tripId,
                type: 'hotel',
                checkInDate: '2026-06-01',
                checkOutDate: '2026-06-03'
            }
        ]);

        // 4. Seed Todo with deadline
        await todoRepo.save({
            id: 'todo1',
            tripId,
            title: '申請申根保險',
            dueDate: '2026-05-25'
        });

        // 5. Execute Shift: Move departure from 2026-06-01 to 2026-06-06 (+5 days)
        const result = await shiftTripDates(tripId, '2026-06-06');

        expect(result.success).toBe(true);
        expect(result.dayDiff).toBe(5);
        expect(result.shiftedPlansCount).toBe(2);
        expect(result.shiftedReservationsCount).toBe(2);
        expect(result.shiftedTodosCount).toBe(1);

        // 6. Verify Trip Dates
        const updatedTrip = await tripRepo.get(tripId);
        expect(updatedTrip.startDate).toBe('2026-06-06');
        expect(updatedTrip.endDate).toBe('2026-06-10');

        // 7. Verify DayPlans Dates
        const updatedPlans = await dayPlanRepo.getByTrip(tripId);
        expect(updatedPlans.find(p => p.id === 'dp1').date).toBe('2026-06-06');
        expect(updatedPlans.find(p => p.id === 'dp2').date).toBe('2026-06-07');

        // 8. Verify Reservations Dates
        const updatedReservations = await reservationRepo.getByTrip(tripId);
        const flight = updatedReservations.find(r => r.id === 'res1');
        expect(flight.departureTime).toBe('2026-06-06T08:00:00');
        expect(flight.arrivalTime).toBe('2026-06-06T20:00:00');

        const hotel = updatedReservations.find(r => r.id === 'res2');
        expect(hotel.checkInDate).toBe('2026-06-06');
        expect(hotel.checkOutDate).toBe('2026-06-08');

        // 9. Verify Todo DueDate
        const updatedTodos = await todoRepo.getByTrip(tripId);
        expect(updatedTodos[0].dueDate).toBe('2026-05-30');
    });
});
