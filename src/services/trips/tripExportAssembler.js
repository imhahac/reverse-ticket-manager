/**
 * tripExportAssembler.js
 * 旅程匯出資料組裝器：
 * 解決景點 (placeItemRepo) 與日程 (dayPlanRepo) 分開儲存的問題，
 * 並統整機票、飯店、活動與旅程預訂，為以下功能提供完整且一致的資料源：
 * 1. A4 旅遊手冊 (TripBrochureModal)
 * 2. iCalendar (.ics) 行事曆匯出
 * 3. GPX (.gpx) 航跡與地標匯出
 * 4. Markdown 行程筆記產生
 */

import { placeItemRepo, dayPlanRepo, packingRepo, expenseRepo, todoRepo } from '../db';
import { getUnifiedReservations } from '../reservations/unifiedReservationService';

/**
 * 依旅程日期與景點清單，組裝每日日程清單 (Day 1 ~ Day N)
 * @param {Object} params
 * @param {Object} params.trip 旅程物件
 * @param {Array} [params.dayPlans] 既有 dayPlans
 * @param {Array} [params.places] 景點清單 (若未提供則從 placeItemRepo 載入)
 * @returns {Array} 完整的每日日程清單，每項均含 places 陣列
 */
export function assembleTripDays({ trip, dayPlans = [], places = [] }) {
    const days = [];
    const startDate = trip?.startDate || '';
    const endDate = trip?.endDate || '';

    // 1. 根據旅程起始與結束日期生成基底日程清單
    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
            let curr = new Date(start);
            let idx = 0;
            while (curr <= end) {
                days.push({
                    dayIndex: idx,
                    dayNumber: idx + 1,
                    date: curr.toISOString().slice(0, 10),
                    theme: '',
                    notes: '',
                    places: []
                });
                curr.setDate(curr.getDate() + 1);
                idx++;
            }
        }
    }

    // 2. 若無有效日期區間，或只有 1 天，但景點中有超出天數的 dayIndex，自動動態擴充天數
    let maxPlaceDayIndex = -1;
    (places || []).forEach(p => {
        const dIdx = Number(p.dayIndex);
        if (Number.isInteger(dIdx) && dIdx > maxPlaceDayIndex) {
            maxPlaceDayIndex = dIdx;
        }
    });

    const targetLength = Math.max(days.length, maxPlaceDayIndex + 1, 1);
    while (days.length < targetLength) {
        const idx = days.length;
        let dateStr = '';
        if (startDate) {
            try {
                const d = new Date(startDate);
                d.setDate(d.getDate() + idx);
                dateStr = d.toISOString().slice(0, 10);
            } catch {
                dateStr = startDate;
            }
        }
        days.push({
            dayIndex: idx,
            dayNumber: idx + 1,
            date: dateStr,
            theme: '',
            notes: '',
            places: []
        });
    }

    // 3. 合併既有 dayPlans 的自訂標題與筆記
    const dayPlanMap = new Map();
    (dayPlans || []).forEach(dp => {
        if (Number.isInteger(dp.dayIndex)) {
            dayPlanMap.set(dp.dayIndex, dp);
        } else if (dp.date) {
            dayPlanMap.set(dp.date, dp);
        }
    });

    days.forEach(day => {
        const matched = dayPlanMap.get(day.dayIndex) || dayPlanMap.get(day.date);
        if (matched) {
            if (matched.theme) day.theme = matched.theme;
            if (matched.notes) day.notes = matched.notes;
            if (matched.id) day.id = matched.id;
        }
    });

    // 4. 將景點依照 dayIndex 分發至各天，並依照 orderIndex 排序
    (places || []).forEach(place => {
        let dIdx = Number(place.dayIndex);
        if (!Number.isInteger(dIdx) || dIdx < 0) {
            dIdx = 0;
        }
        if (dIdx >= days.length) {
            dIdx = days.length - 1;
        }
        days[dIdx].places.push(place);
    });

    // 排序各天景點
    days.forEach(day => {
        day.places.sort((a, b) => (Number(a.orderIndex) || 0) - (Number(b.orderIndex) || 0));
    });

    return days;
}

/**
 * 標準化預訂項目欄位，相容 unifiedReservations 與傳統 reservation 格式
 * @param {Array} reservations
 * @returns {{ flights: Array, hotels: Array, others: Array }}
 */
export function normalizeReservations(reservations = []) {
    const flights = [];
    const hotels = [];
    const others = [];

    (reservations || []).forEach(r => {
        if (!r) return;
        const type = (r.type || '').toLowerCase();

        if (type === 'flight') {
            const fd = r.flightDetails || {};
            flights.push({
                ...r,
                airline: fd.airline || r.airline || '',
                flightNumber: fd.flightNumber || r.flightNumber || r.title || '',
                departureAirport: fd.from || r.departureAirport || '',
                arrivalAirport: fd.to || r.arrivalAirport || '',
                departureTime: fd.departureTime || r.departureTime || r.startDate || '',
                arrivalTime: fd.arrivalTime || r.arrivalTime || r.endDate || '',
                confirmationCode: r.confirmationCode || '',
                seatNumber: r.seatNumber || '',
                departureTerminal: fd.departureTerminal || r.departureTerminal || ''
            });
        } else if (type === 'hotel' || type === 'accommodation') {
            const ad = r.accommodationDetails || {};
            hotels.push({
                ...r,
                title: ad.name || r.title || r.hotelName || '住宿飯店',
                hotelName: ad.name || r.title || r.hotelName || '住宿飯店',
                checkInDate: ad.checkInDate || r.checkInDate || (r.startDate ? r.startDate.slice(0, 10) : ''),
                checkOutDate: ad.checkOutDate || r.checkOutDate || (r.endDate ? r.endDate.slice(0, 10) : ''),
                address: ad.address || r.address || '',
                confirmationCode: r.confirmationCode || ''
            });
        } else {
            others.push(r);
        }
    });

    return { flights, hotels, others };
}

/**
 * 完整載入旅程所有匯出所需資料
 * @param {Object} trip
 * @param {Object} extraSources 外部傳入之 DataContext 資料
 * @returns {Promise<Object>}
 */
export async function loadCompleteTripExportData(trip, extraSources = {}) {
    if (!trip || !trip.id) {
        return {
            tripDays: [],
            flights: [],
            hotels: [],
            others: [],
            packingItems: [],
            expenses: [],
            todos: [],
            allPlaces: [],
            unifiedReservations: []
        };
    }

    const {
        trekReservations = [],
        tickets = [],
        rawHotels = [],
        activities = []
    } = extraSources;

    // 1. 同步從 IndexedDB 載入所有關聯資料
    const [places, existingDayPlans, packingItems, expenses, todos] = await Promise.all([
        placeItemRepo.getByTrip(trip.id).catch(() => []),
        dayPlanRepo.getByTrip(trip.id).catch(() => []),
        packingRepo.getByTrip(trip.id).catch(() => []),
        expenseRepo.getByTrip(trip.id).catch(() => []),
        todoRepo.getByTrip(trip.id).catch(() => [])
    ]);

    // 2. 組裝每日行程清單
    const tripDays = assembleTripDays({
        trip,
        dayPlans: existingDayPlans,
        places
    });

    // 3. 整合通用預訂清單 (機票、飯店、活動)
    const unifiedReservations = getUnifiedReservations(
        trip,
        trekReservations,
        tickets,
        rawHotels,
        activities
    );

    // 4. 標準化預訂分類與欄位
    const { flights, hotels, others } = normalizeReservations(unifiedReservations);

    return {
        trip,
        tripDays,
        flights,
        hotels,
        others,
        packingItems,
        expenses,
        todos,
        allPlaces: places,
        unifiedReservations
    };
}
