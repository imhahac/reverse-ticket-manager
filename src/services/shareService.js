/**
 * shareService.js ── 唯讀行程分享服務
 *
 * 透過 Cloudflare Worker 的 KV 儲存，讓使用者可以將行程分享給他人唯讀瀏覽。
 * 需要設定 VITE_FLIGHT_PROXY_URL（Worker 網址）才能運作。
 */

const PROXY_BASE = (import.meta.env.VITE_FLIGHT_PROXY_URL || 'https://flight-api-proxy.imhahac.workers.dev').replace(/\/+$/, '');

/**
 * 將行程快照發送到 Worker，儲存至 KV，回傳 UUID。
 * @param {Object} snapshot - { trip, itinerary, tripLabels, hotels, activities, dayPlans, reservations }
 * @returns {Promise<string>} 分享 UUID
 */
export async function createShareSnapshot(snapshot) {
    if (!PROXY_BASE) {
        throw new Error('尚未設定 VITE_FLIGHT_PROXY_URL，無法建立分享連結。');
    }

    const res = await fetch(`${PROXY_BASE}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshot),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `分享失敗 (${res.status})`);
    }

    const data = await res.json();
    return data.id; // UUID
}

/**
 * 從 Worker KV 讀取分享快照。
 * @param {string} id - 分享 UUID
 * @returns {Promise<Object>} 行程快照
 */
export async function fetchShareSnapshot(id) {
    if (!PROXY_BASE) {
        throw new Error('尚未設定 VITE_FLIGHT_PROXY_URL，無法讀取分享行程。');
    }

    const res = await fetch(`${PROXY_BASE}/share/${id}`);
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `讀取失敗 (${res.status})`);
    }

    const rawData = await res.json();
    return normalizeShareSnapshot(rawData, id);
}

/**
 * 標準化分享快照資料，相容 Trek 旅程與舊版外站票機酒快照
 * @param {Object} snapshot
 * @param {string} id
 * @returns {Object} { trip, reservations, dayPlans, itinerary, hotels, activities, tripLabels }
 */
export function normalizeShareSnapshot(snapshot, id = 'shared') {
    if (!snapshot || typeof snapshot !== 'object') {
        throw new Error('無效的分享快照資料');
    }

    let trip = snapshot.trip;
    let reservations = Array.isArray(snapshot.reservations) ? [...snapshot.reservations] : [];
    let dayPlans = Array.isArray(snapshot.dayPlans) ? [...snapshot.dayPlans] : [];

    // 若快照內無 trip，但有 itinerary 或 hotels，動態合成為標準 Trip 物件
    if (!trip || !trip.id) {
        const firstItin = snapshot.itinerary?.[0];
        const seg = firstItin?.segments?.[0];
        const title = firstItin?.customLabel || 
                     (seg?.airline && seg?.flightNo ? `${seg.airline} ${seg.flightNo} 旅程` : '分享的精彩旅程');
        const startDate = firstItin?.tripStartAt ? firstItin.tripStartAt.slice(0, 10) : (snapshot.hotels?.[0]?.checkIn || new Date().toISOString().slice(0, 10));
        const endDate = firstItin?.tripEndAt ? firstItin.tripEndAt.slice(0, 10) : (snapshot.hotels?.[snapshot.hotels.length - 1]?.checkOut || startDate);

        trip = {
            id: `shared_${id}`,
            title,
            startDate,
            endDate,
            baseCurrency: 'TWD',
            budget: firstItin?.totalCostTWD || 0,
            status: 'planning',
            isShared: true,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
    } else {
        trip = {
            ...trip,
            isShared: true
        };
    }

    // 若快照中沒有 reservations，但有 itinerary 或 hotels，自動合成為 reservations
    if (reservations.length === 0) {
        const firstItin = snapshot.itinerary?.[0];
        // 1. 機票區段
        if (firstItin?.segments && Array.isArray(firstItin.segments)) {
            firstItin.segments.forEach((seg, idx) => {
                reservations.push({
                    id: `res_seg_${seg.id || idx}`,
                    tripId: trip.id,
                    type: 'flight',
                    title: `${seg.airline || ''} ${seg.flightNo || '航班'}`.trim(),
                    startDate: seg.date || seg.dateTime?.slice(0, 10) || trip.startDate,
                    startTime: seg.time || '10:00',
                    endDate: seg.arrivalDate || seg.arrivalDateTime?.slice(0, 10) || seg.date || trip.startDate,
                    endTime: seg.arrivalTime || '12:00',
                    fromLocation: seg.from || '',
                    toLocation: seg.to || '',
                    confirmationNo: seg.flightNo || '',
                    cost: seg.ticket?.price || 0,
                    currency: seg.ticket?.currency || 'TWD',
                    status: 'confirmed',
                    notes: `航班：${seg.flightNo || ''}`
                });
            });
        }

        // 2. 飯店區段
        const hotelsToUse = (firstItin?.matchedHotels && firstItin.matchedHotels.length > 0)
            ? firstItin.matchedHotels
            : (snapshot.hotels || []);

        hotelsToUse.forEach((h, idx) => {
            reservations.push({
                id: `res_hotel_${h.id || idx}`,
                tripId: trip.id,
                type: 'hotel',
                title: h.name || '住宿飯店',
                startDate: h.checkIn || trip.startDate,
                startTime: '15:00',
                endDate: h.checkOut || trip.endDate,
                endTime: '11:00',
                location: h.address || h.city || '',
                lat: h.lat,
                lng: h.lng,
                confirmationNo: h.confirmationNo || '',
                cost: h.priceTotal || 0,
                currency: h.currency || 'JPY',
                status: 'confirmed',
                notes: h.notes || ''
            });
        });

        // 3. 活動區段
        const activitiesToUse = (firstItin?.matchedActivities && firstItin.matchedActivities.length > 0)
            ? firstItin.matchedActivities
            : (snapshot.activities || []);

        activitiesToUse.forEach((act, idx) => {
            reservations.push({
                id: `res_act_${act.id || idx}`,
                tripId: trip.id,
                type: 'activity',
                title: act.title || act.name || '活動票券',
                startDate: act.date || trip.startDate,
                startTime: act.time || '09:00',
                endDate: act.date || trip.startDate,
                endTime: act.endTime || '18:00',
                location: act.location || act.address || '',
                lat: act.lat,
                lng: act.lng,
                confirmationNo: act.confirmationNo || '',
                cost: act.cost || act.price || 0,
                currency: act.currency || 'TWD',
                status: 'confirmed',
                notes: act.notes || ''
            });
        });
    }

    // 若快照中沒有 dayPlans，依 trip 日期跨度動態產生每日骨架
    if (dayPlans.length === 0 && trip.startDate && trip.endDate) {
        const start = new Date(trip.startDate);
        const end = new Date(trip.endDate);
        const diffDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);

        for (let i = 0; i < Math.min(diffDays, 60); i++) {
            const cur = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
            const dateStr = cur.toISOString().slice(0, 10);
            dayPlans.push({
                id: `day_${trip.id}_${i + 1}`,
                tripId: trip.id,
                dayIndex: i + 1,
                date: dateStr,
                title: `第 ${i + 1} 天`,
                placeItems: []
            });
        }
    }

    return {
        trip,
        reservations,
        dayPlans,
        itinerary: snapshot.itinerary || [],
        hotels: snapshot.hotels || [],
        activities: snapshot.activities || [],
        tripLabels: snapshot.tripLabels || {}
    };
}

/**
 * 建立 Magic Sync 暫存資料快照。
 * @param {Object} data - { tickets, tripLabels, hotels, activities, tripBudgets, tripOverrides }
 * @returns {Promise<string>} 同步 UUID
 */
export async function createMagicSyncSnapshot(data) {
    return createShareSnapshot(data);
}

/**
 * 取得 Magic Sync 暫存資料快照。
 * @param {string} id - 同步 UUID
 * @returns {Promise<Object>} 同步資料
 */
export async function fetchMagicSyncSnapshot(id) {
    const res = await fetch(`${PROXY_BASE}/share/${id}`);
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `讀取失敗 (${res.status})`);
    }
    return res.json();
}
