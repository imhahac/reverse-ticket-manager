/**
 * tripShiftService.js
 * 旅程日期平移 (Move Trip Dates) 引擎：
 * 當旅客變更出發日期時，自動精準推算日期差 (Offset)，
 * 級聯平移所有日程 (DayPlans)、預訂 (航班/火車起降時間、住宿入住退房) 與待辦事項截止日，
 * 避免旅客重新逐筆修改數十個項目的繁瑣工作。
 */

import { getDB, STORES, tripRepo, dayPlanRepo, reservationRepo, todoRepo } from '../db';

/**
 * 計算兩日期之間的完整天數差 (dateB - dateA)
 * @param {string} dateA YYYY-MM-DD
 * @param {string} dateB YYYY-MM-DD
 * @returns {number}
 */
export function calculateDayDifference(dateA, dateB) {
    if (!dateA || !dateB) return 0;
    const da = new Date(dateA + 'T00:00:00Z');
    const db = new Date(dateB + 'T00:00:00Z');
    const diffTime = db.getTime() - da.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * 將日期字串依據天數差平移
 * @param {string} dateStr YYYY-MM-DD 或 YYYY-MM-DDTHH:mm:ss
 * @param {number} dayDiff
 * @returns {string}
 */
export function shiftDateString(dateStr, dayDiff) {
    if (!dateStr || dayDiff === 0) return dateStr;

    // 格式 1: 純日期 YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const d = new Date(dateStr + 'T00:00:00Z');
        d.setUTCDate(d.getUTCDate() + dayDiff);
        return d.toISOString().slice(0, 10);
    }

    // 格式 2: 含時間 ISO (例如 2026-04-01T08:30:00)
    if (/^\d{4}-\d{2}-\d{2}T/.test(dateStr)) {
        const datePart = dateStr.slice(0, 10);
        const timePart = dateStr.slice(10);
        const d = new Date(datePart + 'T00:00:00Z');
        d.setUTCDate(d.getUTCDate() + dayDiff);
        return `${d.toISOString().slice(0, 10)}${timePart}`;
    }

    return dateStr;
}

/**
 * 執行全旅程日期平移重錨定 (具備單一跨 Store 原子交易保護)
 * @param {string} tripId
 * @param {string} newStartDate YYYY-MM-DD
 * @returns {Promise<{ success: boolean, dayDiff: number, shiftedTrip: Object, shiftedPlansCount: number, shiftedReservationsCount: number, shiftedTodosCount: number }>}
 */
export async function shiftTripDates(tripId, newStartDate) {
    if (!tripId || !newStartDate) {
        throw new Error('缺少必要參數 tripId 或 newStartDate');
    }

    const trip = await tripRepo.get(tripId);
    if (!trip) {
        throw new Error(`找不到旅程 ID: ${tripId}`);
    }

    const dayDiff = calculateDayDifference(trip.startDate, newStartDate);
    if (dayDiff === 0) {
        return { success: true, dayDiff: 0, shiftedTrip: trip, shiftedPlansCount: 0, shiftedReservationsCount: 0, shiftedTodosCount: 0 };
    }

    // ── 階段一：在記憶體中預先讀取所有資料 ───────────────────────────────────
    const dayPlans = await dayPlanRepo.getByTrip(tripId);
    const reservations = await reservationRepo.getByTrip(tripId);
    const todos = await todoRepo.getByTrip(tripId);

    // ── 階段二：在記憶體中完成所有實體的日期推算與轉換 (零 DB I/O) ────────────
    const shiftedTrip = {
        ...trip,
        startDate: newStartDate,
        endDate: shiftDateString(trip.endDate, dayDiff),
        updatedAt: Date.now()
    };

    const shiftedPlans = dayPlans.map(plan => ({
        ...plan,
        date: shiftDateString(plan.date, dayDiff),
        updatedAt: Date.now()
    }));

    const shiftedReservations = reservations.map(res => {
        const updated = { ...res, updatedAt: Date.now() };
        if (updated.date) updated.date = shiftDateString(updated.date, dayDiff);
        if (updated.departureTime) updated.departureTime = shiftDateString(updated.departureTime, dayDiff);
        if (updated.arrivalTime) updated.arrivalTime = shiftDateString(updated.arrivalTime, dayDiff);
        if (updated.checkInDate) updated.checkInDate = shiftDateString(updated.checkInDate, dayDiff);
        if (updated.checkOutDate) updated.checkOutDate = shiftDateString(updated.checkOutDate, dayDiff);

        if (Array.isArray(updated.segments)) {
            updated.segments = updated.segments.map(seg => ({
                ...seg,
                departureTime: shiftDateString(seg.departureTime, dayDiff),
                arrivalTime: shiftDateString(seg.arrivalTime, dayDiff)
            }));
        }
        return updated;
    });

    const shiftedTodos = todos.map(todo => ({
        ...todo,
        dueDate: shiftDateString(todo.dueDate, dayDiff),
        updatedAt: Date.now()
    }));

    // ── 階段三：啟動單一跨 Store 原子交易，瞬間一次性 Commit ──────────────────
    const db = await getDB();
    const tx = db.transaction(
        [STORES.TRIPS, STORES.DAY_PLANS, STORES.RESERVATIONS, STORES.TODOS],
        'readwrite'
    );

    // 1. 寫入 Trip
    await tx.objectStore(STORES.TRIPS).put(shiftedTrip);

    // 2. 寫入 DayPlans
    const planStore = tx.objectStore(STORES.DAY_PLANS);
    for (const plan of shiftedPlans) {
        await planStore.put(plan);
    }

    // 3. 寫入 Reservations
    const resStore = tx.objectStore(STORES.RESERVATIONS);
    for (const res of shiftedReservations) {
        await resStore.put(res);
    }

    // 4. 寫入 Todos
    const todoStore = tx.objectStore(STORES.TODOS);
    for (const todo of shiftedTodos) {
        await todoStore.put(todo);
    }

    // 等待交易全數確認 (若任一操作失敗，IndexedDB 自動回滾全體)
    await tx.done;

    return {
        success: true,
        dayDiff,
        shiftedTrip,
        shiftedPlansCount: shiftedPlans.length,
        shiftedReservationsCount: shiftedReservations.length,
        shiftedTodosCount: shiftedTodos.length
    };
}
