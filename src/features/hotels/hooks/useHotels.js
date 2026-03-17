/**
 * useHotels.js ── 飯店住宿資料管理 Hook（骨架）
 *
 * TODO：實作飯店功能時，在此 Hook 中管理：
 *   - hotels: 飯店住宿清單，欄位包含：
 *     { id, name, checkIn, checkOut, roomType, pricePerNight, currency,
 *       priceTWD, confirmationNo, address, notes }
 *   - addHotel(hotel)
 *   - updateHotel(hotel)
 *   - deleteHotel(id)
 *   - 計算衍生欄位：totalNights, totalCostTWD, isPast
 *
 * 使用時應與 useTrips 的趟次資料對齊，以日期範圍匹配對應的飯店住宿。
 */
import { useLocalStorage } from '../../../hooks/useLocalStorage';

export function useHotels() {
    const [hotels, setHotels] = useLocalStorage('travel-hotels', []);

    // TODO: 實作 CRUD 操作
    const addHotel = (hotel) => {
        setHotels(prev => [...prev, { ...hotel, id: Date.now().toString() }]);
    };

    const updateHotel = (hotel) => {
        setHotels(prev => prev.map(h => h.id === hotel.id ? hotel : h));
    };

    const deleteHotel = (id) => {
        setHotels(prev => prev.filter(h => h.id !== id));
    };

    return { hotels, addHotel, updateHotel, deleteHotel };
}
