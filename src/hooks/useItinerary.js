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

export function useItinerary(decoratedTrips, hotels) {
    return useMemo(() => {
        return decoratedTrips.map(trip => {
            const segs = trip.segments || [];
            if (!segs.length || !hotels.length) {
                return { ...trip, matchedHotels: [], totalHotelCostTWD: 0, hotelWarnings: [], hasWarning: false };
            }

            const tripStartDate = segs[0]?.date;
            const tripEndDate   = segs[segs.length - 1]?.date;

            if (!tripStartDate || !tripEndDate) {
                return { ...trip, matchedHotels: [], totalHotelCostTWD: 0, hotelWarnings: [], hasWarning: false };
            }

            // ── 核心修正：雙端嚴格比較，避免跨趟次邊界誤配 ──────────────
            //
            // 條件：h.checkIn < tripEndDate  AND  h.checkOut > tripStartDate
            //
            // 為什麼兩端都用嚴格比較：
            //   Trip1: 5/1~5/5、Trip2: 5/5~5/10
            //   hotelA: checkIn=5/1, checkOut=5/5  → 應只配 Trip1
            //   hotelB: checkIn=5/5, checkOut=5/10 → 應只配 Trip2
            //
            //   若 checkIn <= tripEnd：hotelB.checkIn(5/5) <= Trip1.end(5/5) → 誤配 Trip1 ❌
            //   改為 checkIn < tripEnd：hotelB.checkIn(5/5) < Trip1.end(5/5)? NO → 不配 ✓
            //
            //   若 checkOut >= tripStart：hotelA.checkOut(5/5) >= Trip2.start(5/5) → 誤配 Trip2 ❌
            //   改為 checkOut > tripStart：hotelA.checkOut(5/5) > Trip2.start(5/5)? NO → 不配 ✓
            const matchedHotels = hotels.filter(h =>
                h.checkIn  &&
                h.checkOut &&
                h.checkIn  < tripEndDate   &&  // 嚴格小於：checkIn 當天不算「已結束趟次」
                h.checkOut > tripStartDate      // 嚴格大於：checkOut 當天不算「下一趟起點」
            );

            const totalHotelCostTWD = matchedHotels.reduce(
                (s, h) => s + (h.priceTWD || 0), 0
            );

            // ── 住宿警告：缺口 / 重疊 ──────────────────────────────────────
            const hotelWarnings = (() => {
                const warns = [];
                const tripDays = trip.tripDays || 0;

                if (tripDays > 1 && matchedHotels.length === 0) {
                    warns.push('⚠️ 此趟次尚未安排任何住宿');
                    return warns;
                }

                const valid = [...matchedHotels]
                    .filter(h => h.checkIn && h.checkOut)
                    .sort((a, b) => a.checkIn.localeCompare(b.checkIn));

                for (let i = 0; i < valid.length - 1; i++) {
                    const a = valid[i], b = valid[i + 1];
                    if (b.checkIn < a.checkOut) {
                        warns.push(`⚠️ 住宿重疊：「${a.name}」與「${b.name}」`);
                    } else if (b.checkIn > a.checkOut) {
                        warns.push(`⚠️ 住宿缺口：${a.checkOut} 到 ${b.checkIn} 之間無住宿`);
                    }
                }

                if (tripDays > 1 && valid.length > 0) {
                    if (valid[0].checkIn > tripStartDate) {
                        warns.push(`⚠️ 住宿缺口：${tripStartDate} 到 ${valid[0].checkIn} 之間無住宿`);
                    }
                    if (valid[valid.length - 1].checkOut < tripEndDate) {
                        warns.push(`⚠️ 住宿缺口：${valid[valid.length - 1].checkOut} 到 ${tripEndDate} 之間無住宿`);
                    }
                }

                return warns;
            })();

            const hasWarning = hotelWarnings.length > 0 || trip.isOpenJaw;

            return { ...trip, matchedHotels, totalHotelCostTWD, hotelWarnings, hasWarning };
        });
    }, [decoratedTrips, hotels]);
}
