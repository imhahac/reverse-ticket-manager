import { describe, it, expect, vi } from 'vitest';
import { useItinerary } from '../useItinerary';

// 由於 useItinerary 底下使用 useMemo，在純測試中可以直接呼叫 React hook，
// 或是直接測試 useItinerary 回傳的計算邏輯（由於它是純函數，可以直接提取內建 return 邏輯進行測試，
// 或是使用 renderHook 來執行，但最直接的方法是直接把 decoratedTrips, hotels 丟給 useItinerary 計算出的結果）
// 因為 useItinerary 本身是一個 React Custom Hook 且只用了 useMemo，可以用 renderHook 測試。
// 為了在測試環境中呼叫 React hooks，我們可以使用 @testing-library/react 中的 renderHook。
import { renderHook } from '@testing-library/react';

// Mock localStorage 以防 getCachedAirportCoords 使用
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

describe('useItinerary - Open-Jaw Proximity Warnings', () => {
    it('should issue warning if staying far from departure airport on the checkout/departure day', () => {
        const decoratedTrips = [
            {
                id: 'trip-1',
                isOpenJaw: true,
                isComplete: true,
                segments: [
                    {
                        id: 'seg-1',
                        date: '2026-07-01',
                        arrivalDate: '2026-07-01',
                        from: 'TPE 台北',
                        to: 'NRT 東京',
                        ticket: { type: 'normal' }
                    },
                    {
                        id: 'seg-2',
                        date: '2026-07-10',
                        from: 'KIX 大阪',
                        to: 'TPE 台北',
                        ticket: { type: 'normal' }
                    }
                ],
                tripStartAt: new Date('2026-07-01'),
                tripEndAt: new Date('2026-07-10'),
                tripDays: 10
            }
        ];

        // 飯店：最後一晚（7/9~7/10）住東京（NRT），但 7/10 回程班機是從大阪（KIX）飛。
        // 這時應觸發地點落差警告。
        const hotels = [
            {
                id: 'hotel-1',
                name: '東京最後一晚飯店',
                checkIn: '2026-07-09',
                checkOut: '2026-07-10',
                lat: 35.7647, // NRT 座標
                lng: 140.3863,
                priceTWD: 2000
            }
        ];

        const { result } = renderHook(() => useItinerary(decoratedTrips, hotels, []));
        const finalTrips = result.current;

        // 我們尋找有航班的第一個行程
        const trip = finalTrips.find(t => t.id === 'trip-1');
        expect(trip).toBeDefined();
        
        // 舊邏輯下，因為東京飯店到 NRT 機場距離為 0km < 120km，因此不會有警告。
        // 新邏輯下，退房日 7/10 恰好是回程起飛日，因此僅限比對回程出發地機場 KIX。
        // 由於東京飯店距離 KIX 約 500 公里，應會發出警告！
        expect(trip.hotelWarnings).toContainEqual(
            expect.stringContaining('地點落差警告')
        );
        expect(trip.hotelWarnings).toContainEqual(
            expect.stringContaining('KIX')
        );
    });

    it('should NOT issue warning if staying close to arrival airport on the checkin day', () => {
        const decoratedTrips = [
            {
                id: 'trip-1',
                isOpenJaw: true,
                isComplete: true,
                segments: [
                    {
                        id: 'seg-1',
                        date: '2026-07-01',
                        arrivalDate: '2026-07-01',
                        from: 'TPE 台北',
                        to: 'NRT 東京',
                        ticket: { type: 'normal' }
                    },
                    {
                        id: 'seg-2',
                        date: '2026-07-10',
                        from: 'KIX 大阪',
                        to: 'TPE 台北',
                        ticket: { type: 'normal' }
                    }
                ],
                tripStartAt: new Date('2026-07-01'),
                tripEndAt: new Date('2026-07-10'),
                tripDays: 10
            }
        ];

        // 飯店：第一晚（7/1~7/3）住東京，離 NRT 近。不應該有警告。
        const hotels = [
            {
                id: 'hotel-1',
                name: '東京首兩晚飯店',
                checkIn: '2026-07-01',
                checkOut: '2026-07-03',
                lat: 35.7647,
                lng: 140.3863,
                priceTWD: 2000
            }
        ];

        const { result } = renderHook(() => useItinerary(decoratedTrips, hotels, []));
        const finalTrips = result.current;
        const trip = finalTrips.find(t => t.id === 'trip-1');
        
        expect(trip).toBeDefined();
        // 東京飯店離 NRT 很近，所以不應該有地點警告
        const hasLocWarn = trip.hotelWarnings.some(w => w.includes('地點落差警告'));
        expect(hasLocWarn).toBe(false);
    });
});
