import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runLegacyMigration } from '../legacyMigration';
import { tripRepo, reservationRepo, backupRepo, settingsRepo, getDB } from '../../db';
import { STORAGE_KEYS } from '../../../constants/storageKeys';

const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => { store[key] = value.toString(); },
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; }
    };
})();
vi.stubGlobal('localStorage', localStorageMock);

describe('legacyMigration', () => {
    beforeEach(async () => {
        // Clear IndexedDB stores before each test
        const db = await getDB();
        const tx = db.transaction(['trips', 'reservations', 'backups', 'appSettings'], 'readwrite');
        await tx.objectStore('trips').clear();
        await tx.objectStore('reservations').clear();
        await tx.objectStore('backups').clear();
        await tx.objectStore('appSettings').clear();
        await tx.done;

        localStorage.clear();
    });

    it('should migrate legacy tickets and hotels into Trips and Reservations smoothly', async () => {
        // Mock legacy data
        const mockTickets = [
            {
                id: 't1',
                tripId: 'trip_legacy_1',
                from: 'TPE 台北桃園',
                to: 'NRT 東京成田',
                date: '2025-04-01',
                departureTime: '2025-04-01T09:00:00',
                priceTWD: 12000,
                flightNo: 'CI100'
            },
            {
                id: 't2',
                tripId: 'trip_legacy_1',
                from: 'NRT 東京成田',
                to: 'TPE 台北桃園',
                date: '2025-04-06',
                departureTime: '2025-04-06T14:00:00',
                priceTWD: 13000,
                flightNo: 'CI101'
            }
        ];

        const mockHotels = [
            {
                id: 'h1',
                tripId: 'trip_legacy_1',
                name: 'Tokyo Shinjuku Hotel',
                checkInDate: '2025-04-01',
                checkOutDate: '2025-04-06',
                price: 15000,
                lat: 35.69,
                lng: 139.70
            }
        ];

        localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(mockTickets));
        localStorage.setItem(STORAGE_KEYS.HOTELS, JSON.stringify(mockHotels));
        localStorage.setItem(STORAGE_KEYS.TRIP_LABELS, JSON.stringify({ 'trip_legacy_1': '東京春季賞櫻' }));

        const result = await runLegacyMigration();

        expect(result.migrated).toBe(true);
        expect(result.tripsCount).toBe(1);
        expect(result.reservationsCount).toBe(3); // 2 flights + 1 hotel

        // Verify Trip
        const trips = await tripRepo.getAll();
        expect(trips.length).toBe(1);
        expect(trips[0].title).toBe('東京春季賞櫻');
        expect(trips[0].startDate).toBe('2025-04-01');
        expect(trips[0].endDate).toBe('2025-04-06');
        expect(trips[0].baseCurrency).toBe('TWD');

        // Verify Reservations
        const reservations = await reservationRepo.getByTrip(trips[0].id);
        expect(reservations.length).toBe(3);
        const flight100 = reservations.find(r => r.type === 'flight' && r.flightDetails.flightNumber === 'CI100');
        expect(flight100).toBeDefined();
        expect(flight100.cost).toBe(12000);

        const hotel = reservations.find(r => r.type === 'accommodation');
        expect(hotel).toBeDefined();
        expect(hotel.accommodationDetails.name).toBe('Tokyo Shinjuku Hotel');

        // Verify Backup was created
        const backups = await backupRepo.getAll();
        expect(backups.length).toBe(1);

        // Verify Re-running does not duplicate
        const secondRun = await runLegacyMigration();
        expect(secondRun.migrated).toBe(false);
    });
});
