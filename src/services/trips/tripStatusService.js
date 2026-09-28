/**
 * tripStatusService.js
 * 旅程時序排序與生命週期/封存管理服務
 * 1. 旅程依時間先後排序 (進行與未來旅程按出發日由近到遠升冪排序)
 * 2. 旅程結束自動判定 (endDate < today 自動歸納至已結束)
 * 3. 支援手動封存 (archived / completed) 與解除封存
 */

/**
 * 取得今天日期的 YYYY-MM-DD 字串
 * @returns {string}
 */
export function getTodayDateString() {
    return new Date().toISOString().slice(0, 10);
}

/**
 * 判定旅程當前生命週期狀態
 * @param {Object} trip
 * @param {string} [currentDate] 測試或自訂比對日期 (預設為今天)
 * @returns {'ongoing' | 'planning' | 'completed' | 'archived'}
 */
export function getTripStatus(trip, currentDate = getTodayDateString()) {
    if (!trip) return 'planning';

    // 顯式手動標記優先
    if (trip.status === 'archived' || trip.isArchived) {
        return 'archived';
    }
    if (trip.status === 'completed') {
        return 'completed';
    }

    const start = (trip.startDate || '').slice(0, 10);
    const end = (trip.endDate || start).slice(0, 10);

    // 日期結束自動視為已結束
    if (end && end < currentDate) {
        return 'completed';
    }

    // 旅程正在進行中
    if (start && end && start <= currentDate && currentDate <= end) {
        return 'ongoing';
    }

    return 'planning';
}

/**
 * 檢查旅程是否已結束或已封存
 * @param {Object} trip
 * @param {string} [currentDate]
 * @returns {boolean}
 */
export function isTripArchivedOrEnded(trip, currentDate = getTodayDateString()) {
    const status = getTripStatus(trip, currentDate);
    return status === 'archived' || status === 'completed';
}

/**
 * 依時間與封存狀態智慧排序旅程清單：
 * 1. 進行中與即將到來的旅程 (Active & Upcoming)：按出發日期升冪 (由近到遠，最快要出發的排在最前)
 * 2. 已結束與封存旅程 (Ended & Archived)：按結束日期降冪 (最近結束的排在最前)
 * 
 * @param {Array<Object>} trips
 * @param {Object} [options]
 * @param {string} [options.todayStr]
 * @returns {{ activeTrips: Array<Object>, archivedTrips: Array<Object>, sortedTrips: Array<Object> }}
 */
export function sortTripsByTime(trips = [], { todayStr = getTodayDateString() } = {}) {
    if (!Array.isArray(trips)) {
        return { activeTrips: [], archivedTrips: [], sortedTrips: [] };
    }

    const activeTrips = [];
    const archivedTrips = [];

    trips.forEach(trip => {
        if (!trip) return;
        if (isTripArchivedOrEnded(trip, todayStr)) {
            archivedTrips.push(trip);
        } else {
            activeTrips.push(trip);
        }
    });

    // 1. 進行中/即將到來的旅程：出發日由早到晚 (升冪)，進行中旅程置頂
    activeTrips.sort((a, b) => {
        const isOngoingA = getTripStatus(a, todayStr) === 'ongoing' ? 1 : 0;
        const isOngoingB = getTripStatus(b, todayStr) === 'ongoing' ? 1 : 0;
        if (isOngoingA !== isOngoingB) {
            return isOngoingB - isOngoingA; // 進行中的旅程最優先
        }

        const dateA = a.startDate || '9999-12-31';
        const dateB = b.startDate || '9999-12-31';
        const dateDiff = dateA.localeCompare(dateB);
        if (dateDiff !== 0) return dateDiff;

        return (b.createdAt || 0) - (a.createdAt || 0);
    });

    // 2. 已結束/封存旅程：結束日由近到遠 (降冪，最近結束的在上面)
    archivedTrips.sort((a, b) => {
        const dateA = a.endDate || a.startDate || '0000-00-00';
        const dateB = b.endDate || b.startDate || '0000-00-00';
        const dateDiff = dateB.localeCompare(dateA);
        if (dateDiff !== 0) return dateDiff;

        return (b.createdAt || 0) - (a.createdAt || 0);
    });

    return {
        activeTrips,
        archivedTrips,
        sortedTrips: [...activeTrips, ...archivedTrips]
    };
}
