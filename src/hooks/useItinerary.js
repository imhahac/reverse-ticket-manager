/**
 * useItinerary.js ── 旅程協調層
 *
 * 職責：將 decoratedTrips 與 hotels 合併，
 * 為每個 trip 注入 matchedHotels（日期在趟次範圍內的住宿）。
 *
 * 匹配規則：
 *   hotel.checkIn >= firstSeg.date && hotel.checkOut <= lastSeg.date
 *   （寬鬆版：checkIn 在趟次第一天之後、checkOut 在趟次最後一天之前）
 *
 * @param {Array} decoratedTrips - 來自 App.jsx decoratedTrips useMemo
 * @param {Array} hotels         - 來自 useHotels().hotels（已含衍生欄位）
 * @returns {Array} itinerary    - trips + 每個 trip.matchedHotels / .totalHotelCostTWD
 */
import { useMemo } from 'react';

export function useItinerary(decoratedTrips, hotels) {
    return useMemo(() => {
        return decoratedTrips.map(trip => {
            const segs = trip.segments || [];
            if (!segs.length || !hotels.length) {
                return { ...trip, matchedHotels: [], totalHotelCostTWD: 0 };
            }

            const tripStartDate = segs[0]?.date;
            const tripEndDate   = segs[segs.length - 1]?.date;

            if (!tripStartDate || !tripEndDate) {
                return { ...trip, matchedHotels: [], totalHotelCostTWD: 0 };
            }

            // 邏輯優化：[飯店期間] 與 [行程期間] 只要有重疊就收入（Intersects）
            const matchedHotels = hotels.filter(h =>
                h.checkIn && h.checkOut &&
                h.checkIn <= tripEndDate &&
                h.checkOut >= tripStartDate
            );

            const totalHotelCostTWD = matchedHotels.reduce(
                (s, h) => s + (h.priceTWD || 0), 0
            );

            // ⚠️ 住宿警告檢測 (Gaps/Overlaps)
            const hotelWarnings = (() => {
                const warns = [];
                const tripDays = trip.tripDays || 0;
                if (tripDays > 1 && matchedHotels.length === 0) {
                    warns.push(`⚠️ 此趟次尚未安排任何住宿`);
                    return warns;
                }
                const valid = [...matchedHotels].sort((a, b) => (a.checkIn || '').localeCompare(b.checkIn || ''));
                for (let i = 0; i < valid.length - 1; i++) {
                    const a = valid[i], b = valid[i + 1];
                    if (b.checkIn < a.checkOut) warns.push(`⚠️ 住宿重疊：「${a.name}」與「${b.name}」`);
                    else if (b.checkIn > a.checkOut) warns.push(`⚠️ 住宿缺口：${a.checkOut} 到 ${b.checkIn} 之間無住宿`);
                }
                return warns;
            })();

            const hasWarning = hotelWarnings.length > 0 || trip.isOpenJaw;

            return { ...trip, matchedHotels, totalHotelCostTWD, hotelWarnings, hasWarning };
        });
    }, [decoratedTrips, hotels]);
}
