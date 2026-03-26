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

const TW_CODES = ['TPE', 'TSA', 'KHH', 'RMQ'];
const isTaiwan = (regionStr) => {
    if (!regionStr) return false;
    return TW_CODES.some(code => regionStr.includes(code));
};

export function useItinerary(decoratedTrips, hotels, activities = []) {
    return useMemo(() => {
        return decoratedTrips.map(trip => {
            const segs = trip.segments || [];
            if (!segs.length) {
                return { ...trip, matchedHotels: [], matchedActivities: [], totalHotelCostTWD: 0, hotelWarnings: [], hasWarning: false };
            }

            const tripStartDate = segs[0]?.date;
            const tripEndDate   = segs[segs.length - 1]?.date;

            // ── 動態住宿邊界 (Red-eye & Home) ─────────────────────────────────
            // 預設需要住宿的起訖點即為第一段與最後一段的日期
            let reqStart = tripStartDate;
            const reqEnd = tripEndDate; // 回程起飛當晚不需要訂當地住宿，所以終點就是 tripEndDate

            // 若第一段從台灣出發且為跨日紅眼航班，當晚在飛機上不需要訂房，住宿起點往後推至抵達日
            if (segs.length > 0 && isTaiwan(segs[0].from) && segs[0].arrivalDate && segs[0].arrivalDate > tripStartDate) {
                reqStart = segs[0].arrivalDate;
            }

            if (!tripStartDate || !tripEndDate) {
                return { ...trip, matchedHotels: [], matchedActivities: [], totalHotelCostTWD: 0, hotelWarnings: [], hasWarning: false };
            }

            // ── 核心修正：雙端嚴格比較，避免跨趟次邊界誤配 ──────────────
            const matchedHotels = hotels.filter(h =>
                h.checkIn  &&
                h.checkOut &&
                h.checkIn  < tripEndDate   &&  // 嚴格小於：checkIn 當天不算「已結束趟次」
                h.checkOut > tripStartDate      // 嚴格大於：checkOut 當天不算「下一趟起點」
            );

            const totalHotelCostTWD = matchedHotels.reduce(
                (s, h) => s + (h.priceTWD || 0), 0
            );

            // ── 配對活動與票卷 (支援單日與跨日) ───────────────────────────
            const matchedActivities = activities.filter(a => {
                if (!a.startDate) return false;
                const aStart = a.startDate;
                const aEnd = a.endDate || a.startDate;
                
                // 只要活動區間與趟次區間有任何重疊，就歸屬給這個趟次
                return aStart <= tripEndDate && aEnd >= tripStartDate;
            }).sort((a, b) => {
                if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
                return (a.time || '').localeCompare(b.time || '');
            });

            // ── 住宿警告：缺口 / 重疊 / 地點矛盾 ────────────────────────────────
            const hotelWarnings = (() => {
                const warns = [];
                const tripDays = trip.tripDays || 0;

                // 若動態範圍發現當天去當天回（如 10/1到 10/1走），不需住宿
                if (reqStart >= reqEnd) return warns;

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

                if (valid.length > 0) {
                    if (valid[0].checkIn > reqStart) {
                        warns.push(`⚠️ 住宿缺口：${reqStart} 到 ${valid[0].checkIn} 之間無住宿`);
                    }
                    if (valid[valid.length - 1].checkOut < reqEnd) {
                        warns.push(`⚠️ 住宿缺口：${valid[valid.length - 1].checkOut} 到 ${reqEnd} 之間無住宿`);
                    }
                }

                // ── 地點感知 (Multi-Location Aware Matching) ────────────
                const uniqueCodes = [...new Set(segs.flatMap(s => [s.from?.split(' ')[0], s.to?.split(' ')[0]]))]
                    .filter(code => code && !isTaiwan(code));

                if (uniqueCodes.length > 0 && valid.length > 0) {
                    valid.forEach(h => {
                        // 精確經緯度距離比對 (大於 120km 警告)
                        if (h.lat && h.lng) {
                            let minDistance = Infinity;
                            let nearestAirport = null;

                            uniqueCodes.forEach(code => {
                                const coords = AIRPORT_COORDINATES[code];
                                if (coords) {
                                    const dist = getDistanceFromLatLonInKm(h.lat, h.lng, coords.lat, coords.lng);
                                    if (dist !== null && dist < minDistance) {
                                        minDistance = dist;
                                        nearestAirport = code;
                                    }
                                }
                            });

                            if (minDistance !== Infinity && minDistance > 120) {
                                warns.push(`⚠️ 地點落差警告：「${h.name}」距離最近的機場 (${nearestAirport}) 達 ${Math.round(minDistance)} 公里，請確認是否訂錯國家或城市`);
                            }
                        }
                    });
                }

                return warns;
            })();

            const hasWarning = hotelWarnings.length > 0 || trip.isOpenJaw;

            return { ...trip, matchedHotels, matchedActivities, totalHotelCostTWD, hotelWarnings, hasWarning };
        });
    }, [decoratedTrips, hotels, activities]);
}
