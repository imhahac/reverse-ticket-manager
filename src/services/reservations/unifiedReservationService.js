/**
 * unifiedReservationService.js
 * 整合「機票管理 / 飯店管理 / 票券活動」與「旅程預訂總覽 (Reservations)」
 * 實現全域雙向資料打通與自動關聯
 */

/**
 * 檢查日期區間是否有重疊
 */
/**
 * 檢查日期是否在旅程期間內（具備前後 1 天寬容度，涵蓋跨日航班或時差）
 */
function isDateOverlap(start1, end1, start2, end2) {
    if (!start1 || !start2) return true;
    const s1 = (start1 || '').slice(0, 10);
    const e1 = (end1 || start1).slice(0, 10);
    const s2 = (start2 || '').slice(0, 10);
    const e2 = (end2 || start2).slice(0, 10);

    try {
        const d_s2 = new Date(s2);
        d_s2.setDate(d_s2.getDate() - 1);
        const buf_s2 = d_s2.toISOString().slice(0, 10);

        const d_e2 = new Date(e2);
        d_e2.setDate(d_e2.getDate() + 1);
        const buf_e2 = d_e2.toISOString().slice(0, 10);

        return s1 <= buf_e2 && e1 >= buf_s2;
    } catch {
        return s1 <= e2 && e1 >= s2;
    }
}

/**
 * 將通用票券憑證 (Tickets, Hotels, Activities) 整合至旅程預訂中
 * @param {Object} trip 當前選定旅程
 * @param {Array} trekReservations TrekContext 既有預訂
 * @param {Array} tickets DataContext 機票列表
 * @param {Array} hotels DataContext 飯店列表
 * @param {Array} activities DataContext 票券活動列表
 * @returns {Array} 統一標準化的預訂清單
 */
export function getUnifiedReservations(trip, trekReservations = [], tickets = [], hotels = [], activities = []) {
    const tripStart = trip?.startDate || '';
    const tripEnd = trip?.endDate || '';

    const list = [...(trekReservations || [])];
    const existingCodeSet = new Set(
        list.map(r => (r.confirmationCode || '').trim().toUpperCase()).filter(Boolean)
    );
    const existingTitleSet = new Set(
        list.map(r => (r.title || '').trim().toLowerCase()).filter(Boolean)
    );

    // 1. 整合機票 (Tickets)
    (tickets || []).forEach(ticket => {
        if (!ticket || !ticket.id) return;

        // 提取航段 (相容多種格式：既有 segments 結構 或 標準 ticket 欄位)
        let segs = [];
        if (Array.isArray(ticket.segments) && ticket.segments.length > 0) {
            segs = ticket.segments.map((s, idx) => ({
                id: s.id || `seg_${idx}`,
                flightNo: s.flightNo || '',
                from: s.from || '',
                to: s.to || '',
                date: s.date || '',
                time: s.time || '',
                arrivalDate: s.arrivalDate || s.date || '',
                arrivalTime: s.arrivalTime || '',
                airline: s.airline || s.ticket?.airline || ticket.airline || '',
                segmentType: s.segmentType || (idx === 0 ? '去程' : '回程')
            }));
        } else {
            const isReverse = ticket.type === 'reverse';
            const isOneway = ticket.type === 'oneway';

            const dep1 = isReverse ? ticket.returnRegion : ticket.departRegion;
            const arr1 = isReverse ? ticket.departRegion : ticket.returnRegion;

            if (ticket.outboundDate) {
                segs.push({
                    id: 'outbound',
                    segmentType: '去程',
                    flightNo: ticket.outboundFlightNo || '',
                    from: dep1 || '',
                    to: arr1 || '',
                    date: ticket.outboundDate,
                    time: ticket.outboundTime || '',
                    arrivalDate: ticket.outboundArrivalDate || ticket.outboundDate,
                    arrivalTime: ticket.outboundArrivalTime || '',
                    airline: ticket.airline || ''
                });
            }

            if (!isOneway && ticket.inboundDate) {
                const dep2 = isReverse ? ticket.departRegion : ticket.returnRegion;
                const arr2 = isReverse ? ticket.returnRegion : ticket.departRegion;
                segs.push({
                    id: 'inbound',
                    segmentType: '回程',
                    flightNo: ticket.inboundFlightNo || '',
                    from: dep2 || '',
                    to: arr2 || '',
                    date: ticket.inboundDate,
                    time: ticket.inboundTime || '',
                    arrivalDate: ticket.inboundArrivalDate || ticket.inboundDate,
                    arrivalTime: ticket.inboundArrivalTime || '',
                    airline: ticket.airline || ''
                });
            }
        }

        segs.forEach((seg, idx) => {
            const segDate = seg.date || '';
            // 若有旅程日期，且該段不在旅程範圍內，則跳過
            if (tripStart && tripEnd && segDate && !isDateOverlap(segDate, segDate, tripStart, tripEnd)) {
                return;
            }

            const code = ticket.confirmationCode || ticket.bookingRef || seg.flightNo || '';
            if (code && existingCodeSet.has(code.toUpperCase())) return;

            const routeStr = seg.from && seg.to ? `${seg.from} ✈️ ${seg.to}` : '';
            const titleParts = [
                seg.flightNo,
                seg.segmentType ? `[${seg.segmentType}]` : '',
                routeStr
            ].filter(Boolean);

            const title = titleParts.length > 0
                ? titleParts.join(' ')
                : `${ticket.airline || '航班'} (${seg.from || ''} → ${seg.to || ''})`.trim();

            if (existingTitleSet.has(title.toLowerCase())) return;

            const costPerSeg = Math.round(
                ticket.type === 'oneway'
                    ? (ticket.priceTWD || ticket.price || 0)
                    : ((ticket.priceTWD || ticket.price || 0) / (segs.length || 1))
            );

            list.push({
                id: `unified_ticket_${ticket.id}_${seg.id || idx}`,
                tripId: trip?.id,
                legacyId: ticket.id,
                source: 'ticket_manager',
                sourceLabel: '機票管理同步',
                type: 'flight',
                title: title || '航班機票',
                confirmationCode: code,
                status: ticket.isPaid || ticket.paid ? 'confirmed' : 'pending',
                cost: costPerSeg,
                currency: ticket.currency || 'TWD',
                startDate: segDate ? (seg.time ? `${segDate}T${seg.time}` : segDate) : tripStart,
                endDate: seg.arrivalDate ? (seg.arrivalTime ? `${seg.arrivalDate}T${seg.arrivalTime}` : seg.arrivalDate) : undefined,
                notes: `${ticket.airline ? `航空公司: ${ticket.airline}` : ''}${seg.segmentType ? ` · ${seg.segmentType}` : ''}`.trim(),
                flightDetails: {
                    airline: ticket.airline || seg.airline || '',
                    flightNumber: seg.flightNo || '',
                    from: seg.from || '',
                    to: seg.to || '',
                    departureTime: segDate ? `${segDate} ${seg.time || ''}`.trim() : '',
                    arrivalTime: seg.arrivalDate ? `${seg.arrivalDate} ${seg.arrivalTime || ''}`.trim() : ''
                }
            });
        });
    });

    // 2. 整合住宿 (Hotels)
    (hotels || []).forEach(hotel => {
        const checkIn = hotel.checkIn || '';
        const checkOut = hotel.checkOut || checkIn;

        if (tripStart && tripEnd && (checkIn || checkOut) && !isDateOverlap(checkIn, checkOut, tripStart, tripEnd)) {
            return;
        }

        const code = hotel.confirmationNo || hotel.bookingRef || '';
        if (code && existingCodeSet.has(code.toUpperCase())) return;

        const title = hotel.name || '飯店住宿';
        if (existingTitleSet.has(title.toLowerCase())) return;

        list.push({
            id: `unified_hotel_${hotel.id}`,
            tripId: trip?.id,
            legacyId: hotel.id,
            source: 'hotel_manager',
            sourceLabel: '飯店管理同步',
            type: 'accommodation',
            title: title,
            confirmationCode: code,
            status: 'confirmed',
            cost: Number(hotel.priceTWD || hotel.priceTotal) || 0,
            currency: hotel.currency || 'TWD',
            startDate: checkIn,
            endDate: checkOut,
            notes: hotel.address ? `地址: ${hotel.address}` : '',
            accommodationDetails: {
                name: hotel.name,
                checkInDate: checkIn,
                checkOutDate: checkOut,
                address: hotel.address
            }
        });
    });

    // 3. 整合活動與票券 (Activities)
    (activities || []).forEach(act => {
        const actStart = act.startDate || act.date || '';
        const actEnd = act.endDate || actStart;

        if (tripStart && tripEnd && actStart && !isDateOverlap(actStart, actEnd, tripStart, tripEnd)) {
            return;
        }

        const code = act.confirmationNo || act.bookingRef || '';
        if (code && existingCodeSet.has(code.toUpperCase())) return;

        const title = act.title || '活動票券';
        if (existingTitleSet.has(title.toLowerCase())) return;

        let mappedType = 'activity';
        if (act.category === 'transport') mappedType = 'train';
        else if (act.category === 'dining') mappedType = 'restaurant';
        else if (act.category === 'voucher') mappedType = 'ticket';

        list.push({
            id: `unified_act_${act.id}`,
            tripId: trip?.id,
            legacyId: act.id,
            source: 'activity_manager',
            sourceLabel: '票券憑證同步',
            type: mappedType,
            title: title,
            confirmationCode: code,
            status: 'confirmed',
            cost: Number(act.priceTWD || act.cost) || 0,
            currency: 'TWD',
            startDate: actStart,
            endDate: actEnd,
            notes: act.notes || (act.location ? `地點: ${act.location}` : ''),
            activityDetails: {
                location: act.location,
                time: act.time
            }
        });
    });

    // 依起始時間排序
    list.sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));

    return list;
}
