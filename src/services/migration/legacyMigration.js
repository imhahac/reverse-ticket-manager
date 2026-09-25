/**
 * legacyMigration.js
 * 平滑自動遷移模組：無損升級現有 localStorage/Google Drive 的 reverse-tickets.json 資料
 * 為全新 TREK Trip 與 16 種 Reservations 資料模型，並自動建立雙重還原備份。
 */

import { STORAGE_KEYS } from '../../constants/storageKeys';
import { tripRepo, reservationRepo, settingsRepo, backupRepo } from '../db';
import { logger } from '../../utils/logger';

function safeParse(str, defaultVal) {
    if (!str) return defaultVal;
    try {
        return JSON.parse(str);
    } catch (e) {
        logger.warn('Failed to parse legacy storage string:', e);
        return defaultVal;
    }
}

/**
 * 執行平滑遷移
 * @returns {Promise<{migrated: boolean, tripsCount: number, reservationsCount: number}>}
 */
export async function runLegacyMigration() {
    const isMigrated = await settingsRepo.get('legacy_migration_v1', false);
    if (isMigrated) {
        return { migrated: false, tripsCount: 0, reservationsCount: 0, message: 'Already migrated' };
    }

    // 1. 讀取既有 localStorage 資料
    const rawTickets = safeParse(localStorage.getItem(STORAGE_KEYS.TICKETS), []);
    const tripLabels = safeParse(localStorage.getItem(STORAGE_KEYS.TRIP_LABELS), {});
    const hotels = safeParse(localStorage.getItem(STORAGE_KEYS.HOTELS), []);
    const activities = safeParse(localStorage.getItem(STORAGE_KEYS.ACTIVITIES), []);
    const tripBudgets = safeParse(localStorage.getItem(STORAGE_KEYS.TRIP_BUDGETS), {});
    const tripOverrides = safeParse(localStorage.getItem(STORAGE_KEYS.TRIP_OVERRIDES), {});

    const hasLegacyData = rawTickets.length > 0 || hotels.length > 0 || activities.length > 0;
    if (!hasLegacyData) {
        await settingsRepo.set('legacy_migration_v1', true);
        return { migrated: false, tripsCount: 0, reservationsCount: 0, message: 'No legacy data found' };
    }

    logger.info('🚀 偵測到舊版外站票資料，正在進行無縫遷移...');

    // 2. 建立雙重還原備份 (IndexedDB + LocalStorage)
    const backupPayload = {
        timestamp: new Date().toISOString(),
        tickets: rawTickets,
        tripLabels,
        hotels,
        activities,
        tripBudgets,
        tripOverrides
    };

    await backupRepo.createBackup('Legacy reverse-tickets backup (Pre-migration)', backupPayload);
    try {
        localStorage.setItem('reverse_tickets_legacy_backup', JSON.stringify(backupPayload));
    } catch (e) {
        logger.warn('LocalStorage full, backup stored safely in IndexedDB');
    }

    // 3. 彙總並建構 Trips
    // 依據 ticket 的 tripId 或關聯將機票群組化
    const tripGroups = {};
    for (const ticket of rawTickets) {
        const tripKey = ticket.tripId || ticket.ticketSetId || 'legacy_trip_default';
        if (!tripGroups[tripKey]) {
            tripGroups[tripKey] = {
                tickets: [],
                hotels: [],
                activities: []
            };
        }
        tripGroups[tripKey].tickets.push(ticket);
    }

    // 將未歸屬或依日期歸屬的 hotels 加入對應的 trip
    for (const hotel of hotels) {
        const tripKey = hotel.tripId || Object.keys(tripGroups)[0] || 'legacy_trip_default';
        if (!tripGroups[tripKey]) tripGroups[tripKey] = { tickets: [], hotels: [], activities: [] };
        tripGroups[tripKey].hotels.push(hotel);
    }

    // 將 activities 加入對應的 trip
    for (const act of activities) {
        const tripKey = act.tripId || Object.keys(tripGroups)[0] || 'legacy_trip_default';
        if (!tripGroups[tripKey]) tripGroups[tripKey] = { tickets: [], hotels: [], activities: [] };
        tripGroups[tripKey].activities.push(act);
    }

    let createdTripsCount = 0;
    let createdReservationsCount = 0;

    for (const [tripKey, group] of Object.entries(tripGroups)) {
        // 計算旅程起訖日
        const dates = [];
        group.tickets.forEach(t => {
            if (t.departureTime) dates.push(t.departureTime.slice(0, 10));
            if (t.date) dates.push(t.date.slice(0, 10));
        });
        group.hotels.forEach(h => {
            if (h.checkInDate) dates.push(h.checkInDate);
            if (h.checkOutDate) dates.push(h.checkOutDate);
        });
        dates.sort();

        const startDate = dates[0] || new Date().toISOString().slice(0, 10);
        const endDate = dates[dates.length - 1] || startDate;

        const customTitle = tripLabels[tripKey];
        const defaultTitle = group.tickets.length > 0
            ? `${group.tickets[0].from?.split(' ')[0] || ''} → ${group.tickets[0].to?.split(' ')[0] || ''} 旅程`
            : '外站票旅程';

        const tripId = `trip_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const newTrip = {
            id: tripId,
            title: customTitle || defaultTitle,
            startDate,
            endDate,
            baseCurrency: 'TWD',
            budget: tripBudgets[tripKey] || 0,
            status: endDate < new Date().toISOString().slice(0, 10) ? 'completed' : 'planning',
            isReverseTicketTrip: true,
            legacyTripKey: tripKey,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        await tripRepo.save(newTrip);
        createdTripsCount++;

        // 轉換機票為 Flight Reservations
        for (const t of group.tickets) {
            const resId = `res_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            const flightReservation = {
                id: resId,
                tripId: newTrip.id,
                type: 'flight',
                status: 'confirmed',
                confirmationCode: t.code || t.pnr || '',
                cost: t.priceTWD || t.price || 0,
                currency: 'TWD',
                travellers: t.travellers || [],
                flightDetails: {
                    flightNumber: t.flightNumber || t.flightNo || '',
                    airline: t.airline || '',
                    from: t.from || '',
                    to: t.to || '',
                    departureTime: t.departureTime || t.date || '',
                    arrivalTime: t.arrivalTime || t.date || '',
                    cabinClass: t.cabinClass || 'Economy',
                    seat: t.seat || ''
                },
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            await reservationRepo.save(flightReservation);
            createdReservationsCount++;
        }

        // 轉換飯店為 Accommodation Reservations
        for (const h of group.hotels) {
            const resId = `res_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            const hotelReservation = {
                id: resId,
                tripId: newTrip.id,
                type: 'accommodation',
                status: 'confirmed',
                confirmationCode: h.confirmationCode || '',
                cost: h.price || h.cost || 0,
                currency: h.currency || 'TWD',
                accommodationDetails: {
                    name: h.name || '',
                    checkInDate: h.checkInDate || '',
                    checkOutDate: h.checkOutDate || '',
                    checkInWindow: h.checkInWindow || '15:00 - 23:00',
                    address: h.address || '',
                    lat: h.lat,
                    lng: h.lng
                },
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            await reservationRepo.save(hotelReservation);
            createdReservationsCount++;
        }

        // 轉換活動為 Activity Reservations
        for (const act of group.activities) {
            const resId = `res_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            const actReservation = {
                id: resId,
                tripId: newTrip.id,
                type: 'activity',
                status: 'confirmed',
                cost: act.cost || act.price || 0,
                currency: 'TWD',
                activityDetails: {
                    title: act.title || act.name || '',
                    date: act.date || '',
                    time: act.time || '',
                    location: act.location || ''
                },
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            await reservationRepo.save(actReservation);
            createdReservationsCount++;
        }
    }

    // 標記遷移完成
    await settingsRepo.set('legacy_migration_v1', true);
    logger.info(`✅ 平滑遷移完成：建立了 ${createdTripsCount} 個 Trip 與 ${createdReservationsCount} 筆預訂項目`);

    return {
        migrated: true,
        tripsCount: createdTripsCount,
        reservationsCount: createdReservationsCount
    };
}
