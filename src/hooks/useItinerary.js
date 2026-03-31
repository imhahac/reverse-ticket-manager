/**
 * useItinerary.js ── 旅程協調層
 *
 * 職責：將 decoratedTrips 與 hotels 合併，
 * 為每個 trip 注入 matchedHotels（日期在趟次範圍內的住宿）。
 *
 * 匹配規則（修正版）：
 *   hotel.checkIn  <= tripEndDate      （飯店開始不超過行程結束）
 *   hotel.checkOut >  tripStartDate    （使用嚴格大於，避免 checkOut 恰好等於
 *                                       下一趟 tripStartDate 時誤配到下一趟）
 *
 * 修正說明：
 *   舊版用 checkOut >= tripStartDate，會使「前一趟最後一天 checkout」
 *   的飯店被同日出發的下一趟誤配。改為嚴格大於後，
 *   例如飯店 5/5~5/10 checkout 時，對下一趟 5/10 出發的行程
 *   checkOut(5/10) > tripStartDate(5/10) 不成立 → 不再誤配。
 */
import { useMemo } from 'react';
import { AIRPORT_COORDINATES, getDistanceFromLatLonInKm } from '../utils/geoUtils';
import { isTaiwan } from '../utils/airportUtils';

export function useItinerary(decoratedTrips, hotels, activities = []) {
    return useMemo(() => {
        const matchedHotelIds = new Set();
        const matchedActivityIds = new Set();

        // 1. 處理有航班的行程
        const tripItineraries = decoratedTrips.map(trip => {
            const segs = trip.segments || [];
            if (!segs.length) {
                return { ...trip, matchedHotels: [], matchedActivities: [], totalHotelCostTWD: 0, hotelWarnings: [], hasWarning: false };
            }

            const tripStartDate = segs[0]?.date;
            const tripEndDate   = segs[segs.length - 1]?.date;

            // ── 動態住宿邊界 (Red-eye & Home) ─────────────────────────────────
            let reqStart = tripStartDate;
            const reqEnd = tripEndDate;

            if (segs.length > 0 && isTaiwan(segs[0].from) && segs[0].arrivalDate && segs[0].arrivalDate > tripStartDate) {
                reqStart = segs[0].arrivalDate;
            }

            // ── 匹配住宿 ──────────────────────────────────────────────────
            const matchedHotels = hotels.filter(h => {
                const isMatch = h.checkIn && h.checkOut && h.checkIn < tripEndDate && h.checkOut > tripStartDate;
                if (isMatch) matchedHotelIds.add(h.id);
                return isMatch;
            });

            // ── 匹配活動 ──────────────────────────────────────────────────
            const matchedActivities = activities.filter(a => {
                if (!a.startDate) return false;
                const aStart = a.startDate;
                const aEnd = a.endDate || a.startDate;
                const isMatch = aStart <= tripEndDate && aEnd >= tripStartDate;
                if (isMatch) matchedActivityIds.add(a.id);
                return isMatch;
            }).sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));

            const totalHotelCostTWD = matchedHotels.reduce((s, h) => s + (h.priceTWD || 0), 0);

            // ── 警告處理 ──────────────────────────────────────────────────
            const hotelWarnings = (() => {
                const warns = [];
                const tripDays = trip.tripDays || 0;

                const checkLocationWarnings = (validHotels) => {
                    const locWarns = [];
                    const uniqueCodes = [...new Set(segs.flatMap(s => [s.from?.split(' ')[0], s.to?.split(' ')[0]]))]
                        .filter(code => code && !isTaiwan(code));

                    if (uniqueCodes.length > 0 && validHotels.length > 0) {
                        validHotels.forEach(h => {
                            if (h.lat && h.lng) {
                                let minDistance = Infinity;
                                let nearestAirport = null;
                                uniqueCodes.forEach(code => {
                                    const coords = AIRPORT_COORDINATES[code];
                                    if (coords) {
                                        const dist = getDistanceFromLatLonInKm(h.lat, h.lng, coords.lat, coords.lng);
                                        if (dist !== null && dist < minDistance) { minDistance = dist; nearestAirport = code; }
                                    }
                                });
                                if (minDistance !== Infinity && minDistance > 120) {
                                    locWarns.push(`⚠️ 地點落差警告：「${h.name}」距離最近的機場 (${nearestAirport}) 達 ${Math.round(minDistance)} 公里`);
                                }
                            }
                        });
                    }
                    return locWarns;
                };

                const valid = [...matchedHotels].filter(h => h.checkIn && h.checkOut).sort((a, b) => a.checkIn.localeCompare(b.checkIn));
                if (reqStart >= reqEnd) return checkLocationWarnings(valid);
                if (tripDays > 1 && matchedHotels.length === 0) {
                    warns.push('⚠️ 此趟次尚未安排任何住宿');
                    return warns;
                }
                for (let i = 0; i < valid.length - 1; i++) {
                    const a = valid[i], b = valid[i + 1];
                    if (b.checkIn < a.checkOut) warns.push(`⚠️ 住宿重疊：「${a.name}」與「${b.name}」`);
                    else if (b.checkIn > a.checkOut) warns.push(`⚠️ 住宿缺口：${a.checkOut} 到 ${b.checkIn} 之間無住宿`);
                }
                if (valid.length > 0) {
                    if (valid[0].checkIn > reqStart) warns.push(`⚠️ 住宿缺口：${reqStart} 到 ${valid[0].checkIn} 之間無住宿`);
                    if (valid[valid.length - 1].checkOut < reqEnd) warns.push(`⚠️ 住宿缺口：${valid[valid.length - 1].checkOut} 到 ${reqEnd} 之間無住宿`);
                }
                return [...warns, ...checkLocationWarnings(valid)];
            })();

            return { ...trip, matchedHotels, matchedActivities, totalHotelCostTWD, hotelWarnings, hasWarning: hotelWarnings.length > 0 || trip.isOpenJaw };
        });

        // 2. 處理孤兒物件 (Orphaned Items)
        const orphanHotels = hotels.filter(h => !matchedHotelIds.has(h.id));
        const orphanActivities = activities.filter(a => !matchedActivityIds.has(a.id));

        const virtualTrips = [];
        
        // 簡單策略：每一筆孤兒住宿都自成一個「虛擬行程」
        orphanHotels.forEach(h => {
            const startDate = h.checkIn;
            const endDate = h.checkOut;
            virtualTrips.push({
                id: `virtual-hotel-${h.id}`,
                isVirtual: true,
                segments: [],
                tripStartAt: new Date(startDate + 'T00:00:00'),
                tripEndAt: new Date(endDate + 'T23:59:59'),
                tripDays: Math.ceil((new Date(endDate) - new Date(startDate)) / 86400000),
                matchedHotels: [h],
                matchedActivities: [],
                totalHotelCostTWD: h.priceTWD || 0,
                totalCostTWD: 0,
                hotelWarnings: [], // 虛擬行程暫不顯示警告，因為無對比基準
                isPast: new Date(endDate) < new Date(),
                isComplete: true,
                customLabel: `🏨 ${h.name}`
            });
        });

        // 剩餘的孤兒活動，如果沒跟住宿重疊，也自成一格
        orphanActivities.forEach(a => {
            const startDate = a.startDate;
            const endDate = a.endDate || a.startDate;
            virtualTrips.push({
                id: `virtual-act-${a.id}`,
                isVirtual: true,
                segments: [],
                tripStartAt: new Date(startDate + 'T00:00:00'),
                tripEndAt: new Date(endDate + 'T23:59:59'),
                tripDays: Math.ceil((new Date(endDate) - new Date(startDate)) / 86400000) || 1,
                matchedHotels: [],
                matchedActivities: [a],
                totalHotelCostTWD: 0,
                totalCostTWD: 0,
                hotelWarnings: [],
                isPast: new Date(endDate) < new Date(),
                isComplete: true,
                customLabel: `🎫 ${a.title}`
            });
        });

        // 3. 全局合併並排序
        return [...tripItineraries, ...virtualTrips].sort((a, b) => {
            const dateA = a.tripStartAt ? a.tripStartAt.getTime() : 0;
            const dateB = b.tripStartAt ? b.tripStartAt.getTime() : 0;
            return dateA - dateB;
        });
    }, [decoratedTrips, hotels, activities]);
}
