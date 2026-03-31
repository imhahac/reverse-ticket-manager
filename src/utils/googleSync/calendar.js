import { addHours, format } from 'date-fns';
import { getFlightAwareUrl } from '../flightUtils';
import { addHoursToLocalStr, getIanaTimeZone } from './mapper';
import { logger } from '../logger';

/**
 * 同步到 Google Calendar
 */
export const syncToCalendar = async (segments, hotels = [], activities = [], accessToken) => {
    try {
        const calendarId = 'primary';
        let state = { count: 0, deletedCount: 0, errorLog: '', updatedCalendarIds: {}, updatedHotelCalendarIds: {}, updatedActivityCalendarIds: {} };

        // 1. 清理孤兒事件
        const cleanupRes = await cleanupOrphanEvents(calendarId, accessToken, segments, hotels, activities);
        if (cleanupRes.expired) return { success: false, expired: true };
        state.deletedCount = cleanupRes.deletedCount;
        state.errorLog += cleanupRes.errorLog;

        // 2. 同步航班
        const flightRes = await syncFlights(calendarId, accessToken, segments);
        if (flightRes.expired) return { success: false, expired: true };
        state.count += flightRes.count;
        state.errorLog += flightRes.errorLog;
        state.updatedCalendarIds = flightRes.updatedCalendarIds;

        // 3. 同步飯店
        const hotelRes = await syncHotels(calendarId, accessToken, hotels);
        if (hotelRes.expired) return { success: false, expired: true };
        state.count += hotelRes.count;
        state.updatedHotelCalendarIds = hotelRes.updatedHotelCalendarIds;

        // 4. 同步活動
        const actRes = await syncActivities(calendarId, accessToken, activities);
        if (actRes.expired) return { success: false, expired: true };
        state.count += actRes.count;
        state.updatedActivityCalendarIds = actRes.updatedActivityCalendarIds;

        if (state.count === 0 && state.deletedCount === 0 && state.errorLog === '') {
            return { success: false, ...state, error: '目前沒有行程事件需要同步' };
        }
        return { success: state.errorLog === '' || state.count > 0 || state.deletedCount > 0, ...state, error: state.errorLog };
    } catch (e) {
        logger.error('Calendar Sync Error:', e);
        return { success: false, count: 0, deletedCount: 0, error: e.message };
    }
};

async function cleanupOrphanEvents(calendarId, accessToken, segments, hotels, activities) {
    let deletedCount = 0;
    let errorLog = '';
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?privateExtendedProperty=reverseTicketApp%3Dtrue&maxResults=500&singleEvents=true`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (res.status === 401) return { expired: true };
    if (!res.ok) return { deletedCount: 0, errorLog: '無法讀取日曆事件進行清理\n' };

    const data = await res.json();
    const activeSegIds = new Set(segments.map(s => s.id));
    const activeHotelIds = new Set(hotels.map(h => h.id));
    const activeActivityIds = new Set(activities.map(a => a.id));

    for (const ev of (data.items || [])) {
        const { private: props } = ev.extendedProperties || { private: {} };
        const isOrphan = (props.reverseTicketSegId && !activeSegIds.has(props.reverseTicketSegId)) ||
                         (props.reverseTicketHotelId && !activeHotelIds.has(props.reverseTicketHotelId)) ||
                         (props.reverseTicketActivityId && !activeActivityIds.has(props.reverseTicketActivityId));
        if (isOrphan) {
            const del = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${ev.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
            if (del.ok || del.status === 204 || del.status === 410) deletedCount++;
            else errorLog += `刪除孤兒事件失敗 (${ev.summary})\n`;
        }
    }
    return { deletedCount, errorLog };
}

async function syncFlights(calendarId, accessToken, segments) {
    let count = 0, errorLog = '', updatedCalendarIds = {};
    for (const seg of segments) {
        const tz = getIanaTimeZone(seg);
        const airline = seg.ticket?.airline || '';
        const summary = `[航班] ${seg.flightNo ? `${airline} (${seg.flightNo})` : airline} ${seg.from}✈️${seg.to}`;
        const start = seg.time ? { dateTime: `${seg.date}T${seg.time}:00`, timeZone: tz } : { date: seg.date };
        const end = seg.time ? { dateTime: (seg.arrivalDate && seg.arrivalTime) ? `${seg.arrivalDate}T${seg.arrivalTime}:00` : addHoursToLocalStr(`${seg.date}T${seg.time}:00`, 2), timeZone: tz } : { date: format(addHours(new Date(seg.date + 'T00:00:00'), 24), 'yyyy-MM-dd') };

        let eventId = seg.ticket.calendarIds?.[seg.id];
        const faUrl = getFlightAwareUrl(seg.flightNo);
        const body = { summary, start, end, description: `由管理系統自動建立。\n追蹤航班: ${faUrl}`, extendedProperties: { private: { reverseTicketApp: 'true', reverseTicketSegId: seg.id } } };
        const method = eventId ? 'PUT' : 'POST';
        const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events${eventId ? `/${eventId}` : ''}`;

        const res = await fetch(url, { method, headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (res.ok) {
            const d = await res.json();
            count++;
            if (!updatedCalendarIds[seg.ticket.id]) updatedCalendarIds[seg.ticket.id] = {};
            updatedCalendarIds[seg.ticket.id][seg.id] = d.id;
        } else if (res.status === 401) return { expired: true };
        else errorLog += `同步航班失敗 (${summary})\n`;
    }
    return { count, errorLog, updatedCalendarIds };
}

async function syncHotels(calendarId, accessToken, hotels) {
    let count = 0, updatedHotelCalendarIds = {};
    for (const hotel of hotels) {
        if (!hotel.checkIn || !hotel.checkOut) continue;
        const body = { summary: `[住宿] ${hotel.name}`, description: `Check-in: ${hotel.checkIn}\nCheck-out: ${hotel.checkOut}`, start: { date: hotel.checkIn }, end: { date: hotel.checkOut }, extendedProperties: { private: { reverseTicketApp: 'true', reverseTicketHotelId: hotel.id } } };
        const eventId = hotel.calendarCheckInId;
        const method = eventId ? 'PUT' : 'POST';
        const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events${eventId ? `/${eventId}` : ''}`;
        const res = await fetch(url, { method, headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (res.ok) {
            const d = await res.json();
            count++;
            updatedHotelCalendarIds[hotel.id] = { checkInId: d.id, checkOutId: null };
        } else if (res.status === 401) return { expired: true };
    }
    return { count, updatedHotelCalendarIds };
}

async function syncActivities(calendarId, accessToken, activities) {
    let count = 0, updatedActivityCalendarIds = {};
    for (const activity of activities) {
        if (!activity.startDate) continue;
        const start = activity.time ? { dateTime: `${activity.startDate}T${activity.time}:00` } : { date: activity.startDate };
        const end = activity.time ? { dateTime: addHoursToLocalStr(`${activity.startDate}T${activity.time}:00`, 2) } : { date: format(addHours(new Date((activity.endDate || activity.startDate) + 'T00:00:00'), 24), 'yyyy-MM-dd') };
        const body = { summary: `[活動] ${activity.title}`, start, end, extendedProperties: { private: { reverseTicketApp: 'true', reverseTicketActivityId: activity.id } } };
        const eventId = activity.calendarId;
        const method = eventId ? 'PUT' : 'POST';
        const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events${eventId ? `/${eventId}` : ''}`;
        const res = await fetch(url, { method, headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (res.ok) {
            const d = await res.json();
            count++;
            updatedActivityCalendarIds[activity.id] = d.id;
        } else if (res.status === 401) return { expired: true };
    }
    return { count, updatedActivityCalendarIds };
}
