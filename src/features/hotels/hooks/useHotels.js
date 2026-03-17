/**
 * useHotels.js ── 飯店住宿資料管理 Hook
 *
 * 管理：hotels CRUD + 衍生欄位計算
 *
 * 飯店資料結構：
 *   { id, name, address, checkIn, checkOut,
 *     currency, priceTotal, priceTWD,     ← 原始金額 + TWD 換算
 *     confirmationNo, notes,
 *     calendarCheckInId, calendarCheckOutId  ← 日曆事件 ID（同步後寫入）
 *   }
 *
 * 衍生欄位（裝飾後回傳，不存入 LocalStorage）：
 *   totalNights    : 入住晚數
 *   costPerNight   : priceTWD / totalNights
 *   isPast         : checkOut < now
 */
import { useMemo } from 'react';
import { useLocalStorage } from '../../../hooks/useLocalStorage';

export function useHotels() {
    const [hotels, setHotels] = useLocalStorage('travel-hotels', []);

    // ── 衍生欄位裝飾 ──────────────────────────────────────────────────────
    const decoratedHotels = useMemo(() => {
        const now = Date.now();
        return hotels.map(h => {
            let totalNights = null;
            if (h.checkIn && h.checkOut) {
                const diff = new Date(h.checkOut) - new Date(h.checkIn);
                totalNights = Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));
            }
            const costPerNight = (totalNights && h.priceTWD)
                ? Math.round(h.priceTWD / totalNights)
                : null;
            const isPast = h.checkOut
                ? new Date(h.checkOut).getTime() < now
                : false;
            return { ...h, totalNights, costPerNight, isPast };
        });
    }, [hotels]);

    // ── CRUD ──────────────────────────────────────────────────────────────
    const addHotel = (hotel) =>
        setHotels(prev => [...prev, { ...hotel, id: `hotel-${Date.now()}` }]);

    const updateHotel = (hotel) =>
        setHotels(prev => prev.map(h => h.id === hotel.id ? hotel : h));

    const deleteHotel = (id) =>
        setHotels(prev => prev.filter(h => h.id !== id));

    /** 將 Google Calendar 事件 ID 回寫（同步後呼叫）*/
    const updateHotelCalendarIds = (hotelId, checkInEventId, checkOutEventId) =>
        setHotels(prev => prev.map(h =>
            h.id === hotelId
                ? { ...h, calendarCheckInId: checkInEventId, calendarCheckOutId: checkOutEventId }
                : h
        ));

    return {
        hotels: decoratedHotels,
        rawHotels: hotels,          // 供 Drive 備份用（不含衍生欄位）
        addHotel,
        updateHotel,
        deleteHotel,
        updateHotelCalendarIds,
        setHotels,                  // 供雲端載入整批替換
    };
}
