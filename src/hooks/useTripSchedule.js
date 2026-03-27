import { useMemo } from 'react';

/**
 * useTripSchedule.js ── 行程時間軸佈局 Hook (Timeline Layout)
 * 
 * 🎨 運作邏輯:
 * 1. 收集所有相關日期: 航班出發/抵達、飯店 Check-in/Out、活動日期。
 * 2. 過濾重複並升冪排序，決定行程涵蓋的所有「關鍵日期」。
 * 3. 以第一個日期為 Day 1，計算各日期對應的相對天數 (dayNum)。
 * 4. 將航段、飯店、活動分別過濾並歸類至對應的日期物件中，供 UI 渲染。
 */
export const useTripSchedule = (segments, matchedHotels, matchedActivities) => {
    return useMemo(() => {
        const dateSet = new Set([
            ...segments.map(s => s.date),
            ...segments.map(s => s.arrivalDate).filter(Boolean),
            ...matchedHotels.map(h => h.checkIn).filter(Boolean),
            ...matchedHotels.map(h => h.checkOut).filter(Boolean),
            ...matchedActivities.filter(a => !a.endDate || a.endDate === a.startDate).map(a => a.startDate).filter(Boolean)
        ]);
        const sortedDates = Array.from(dateSet).sort();
        const minDate = sortedDates.length > 0 ? new Date(sortedDates[0]) : null;

        return sortedDates.map(dateStr => {
            const currDate = new Date(dateStr);
            const diffTime = Math.abs(currDate - minDate);
            // new Date("YYYY-MM-DD") is used. The difference in days should be stable even across timezones 
            // as long as the same midnight UTC timestamp concept is used, but we stick to the project's logic.
            const dayNum = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
            
            return {
                dateStr, dayNum,
                flights: segments.filter(s => s.date === dateStr),
                checkIns: matchedHotels.filter(h => h.checkIn === dateStr),
                checkOuts: matchedHotels.filter(h => h.checkOut === dateStr),
                activities: matchedActivities.filter(a => a.startDate === dateStr && (!a.endDate || a.endDate === a.startDate))
            };
        });
    }, [segments, matchedHotels, matchedActivities]);
};
