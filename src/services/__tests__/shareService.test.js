import { describe, it, expect } from 'vitest';
import { normalizeShareSnapshot } from '../shareService';

describe('shareService', () => {
    describe('normalizeShareSnapshot', () => {
        it('應正確處理包含完整 trip, reservations, dayPlans 的 Trek 快照', () => {
            const mockSnapshot = {
                trip: {
                    id: 'trip_123',
                    title: '東京賞櫻行',
                    startDate: '2026-04-01',
                    endDate: '2026-04-06',
                    baseCurrency: 'JPY',
                    budget: 50000
                },
                reservations: [
                    { id: 'res_1', type: 'flight', title: 'BR198' }
                ],
                dayPlans: [
                    { id: 'day_1', dayIndex: 1, title: '第 1 天' }
                ]
            };

            const normalized = normalizeShareSnapshot(mockSnapshot, 'uuid_123');
            expect(normalized.trip.id).toBe('trip_123');
            expect(normalized.trip.title).toBe('東京賞櫻行');
            expect(normalized.trip.isShared).toBe(true);
            expect(normalized.reservations.length).toBe(1);
            expect(normalized.dayPlans.length).toBe(1);
        });

        it('應能將 trip 為 null 的外站票/舊版機酒快照自動合成為合法 Trip 與 Reservations', () => {
            const legacySnapshot = {
                trip: null,
                itinerary: [
                    {
                        customLabel: '東京跨年 12 天',
                        tripStartAt: '2026-12-23T10:05:00.000Z',
                        tripEndAt: '2027-01-03T08:55:00.000Z',
                        segments: [
                            { id: 'seg_1', airline: '中華航空', flightNo: 'CI222', date: '2026-12-23', from: 'TSA', to: 'HND' },
                            { id: 'seg_2', airline: '中華航空', flightNo: 'CI221', date: '2027-01-03', from: 'HND', to: 'TSA' }
                        ],
                        matchedHotels: [
                            { id: 'hotel_1', name: '東橫INN 日本橋', checkIn: '2026-12-23', checkOut: '2027-01-03', priceTotal: 45000 }
                        ]
                    }
                ],
                hotels: [],
                activities: []
            };

            const normalized = normalizeShareSnapshot(legacySnapshot, 'c0fef436');
            expect(normalized.trip).toBeDefined();
            expect(normalized.trip.title).toBe('東京跨年 12 天');
            expect(normalized.trip.startDate).toBe('2026-12-23');
            expect(normalized.trip.endDate).toBe('2027-01-03');
            expect(normalized.trip.isShared).toBe(true);

            // 檢查是否自動合成出預訂項目 (2 筆機票 + 1 筆飯店)
            expect(normalized.reservations.length).toBe(3);
            expect(normalized.reservations[0].type).toBe('flight');
            expect(normalized.reservations[0].title).toContain('CI222');
            expect(normalized.reservations[2].type).toBe('hotel');
            expect(normalized.reservations[2].title).toBe('東橫INN 日本橋');

            // 檢查是否自動生成 12 天骨架
            expect(normalized.dayPlans.length).toBe(12);
            expect(normalized.dayPlans[0].date).toBe('2026-12-23');
            expect(normalized.dayPlans[11].date).toBe('2027-01-03');
        });
    });
});
