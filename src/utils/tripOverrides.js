const isTaiwan = (regionStr) => {
    const twCodes = ['TPE', 'TSA', 'KHH', 'RMQ'];
    return twCodes.some(code => (regionStr || '').includes(code));
};

function toLocalDateTime(seg) {
    if (seg?.dateTime instanceof Date && !isNaN(seg.dateTime.getTime())) return seg.dateTime;
    if (seg?.date && seg?.time) return new Date(`${seg.date}T${seg.time}:00`);
    if (seg?.date) return new Date(`${seg.date}T00:00:00`);
    return new Date(0);
}

export function applyTripOverrides(autoTrips, overrides) {
    const safe = overrides && typeof overrides === 'object' ? overrides : {};
    const segTripId = safe.segTripId && typeof safe.segTripId === 'object' ? safe.segTripId : {};
    const removed = new Set(Array.isArray(safe.removedSegIds) ? safe.removedSegIds : []);
    const tripOrder = Array.isArray(safe.tripOrder) ? safe.tripOrder : [];

    const autoTripById = new Map(autoTrips.map(t => [t.id, t]));

    // Flatten segments from auto trips, but keep original order info
    const segs = [];
    for (const trip of autoTrips) {
        const list = [];
        if (trip.outbound) list.push(trip.outbound);
        list.push(...(trip.connections || []));
        if (trip.inbound) list.push(trip.inbound);
        for (const seg of list) {
            segs.push({ seg, originalTripId: trip.id });
        }
    }

    const tripIdToSegs = new Map();
    const ensureTrip = (tripId) => {
        if (!tripIdToSegs.has(tripId)) tripIdToSegs.set(tripId, []);
        return tripIdToSegs.get(tripId);
    };

    for (const { seg, originalTripId } of segs) {
        if (!seg?.id) continue;
        if (removed.has(seg.id)) continue;
        const targetTripId = segTripId[seg.id] || originalTripId;
        ensureTrip(targetTripId).push(seg);
    }

    // Build display trips
    const displayTripIds = (() => {
        const ids = new Set();
        // prefer manual tripOrder if user has one
        for (const id of tripOrder) ids.add(id);
        for (const t of autoTrips) ids.add(t.id);
        for (const id of tripIdToSegs.keys()) ids.add(id);
        return Array.from(ids);
    })();

    const displayTrips = [];
    for (const tripId of displayTripIds) {
        const base = autoTripById.get(tripId);
        const segments = (tripIdToSegs.get(tripId) || []).slice().sort((a, b) => toLocalDateTime(a) - toLocalDateTime(b));

        if (segments.length === 0) continue;

        const hasTW = segments.some(s => isTaiwan(s.from) || isTaiwan(s.to));
        displayTrips.push({
            ...base,
            id: tripId,
            segments,
            isExternalOnly: !hasTW,
            // 若是手動 trip（非原本 auto trip），預設視為未完結
            isComplete: base ? base.isComplete : false,
        });
    }

    return displayTrips;
}

