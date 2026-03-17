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

            // 飯店 checkIn 在趟次出發後、checkOut 在趟次返回前（或當天）
            const matchedHotels = hotels.filter(h =>
                h.checkIn && h.checkOut &&
                h.checkIn >= tripStartDate &&
                h.checkOut <= tripEndDate
            );

            const totalHotelCostTWD = matchedHotels.reduce(
                (s, h) => s + (h.priceTWD || 0), 0
            );

            return { ...trip, matchedHotels, totalHotelCostTWD };
        });
    }, [decoratedTrips, hotels]);
}
