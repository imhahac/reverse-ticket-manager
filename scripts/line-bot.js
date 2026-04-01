import { google } from 'googleapis';
import axios from 'axios';
import { format, addDays, parseISO } from 'date-fns';

/**
 * LINE Bot Cron Job v2
 * 🚀 支持 OAuth2 認證
 * 🚀 支持 虛擬行程 (Virtual Trips) 偵測
 * 🚀 文字版訊息優化 (含 FlightAware & 飯店詳情)
 */

// ==========================================
// 1. 核心邏輯共享區 (由前端邏輯移植)
// ==========================================
const TW_CODES = ['TPE', 'TSA', 'KHH', 'RMQ'];
const isTaiwan = (regionStr) => {
    if (!regionStr) return false;
    return TW_CODES.some(code => regionStr.includes(code));
};

function getItinerary(tickets, hotels, activities = []) {
    // 1. 處理機票行程
    const segments = [];
    tickets.filter(t => t?.id).forEach(t => {
        const outDT = new Date(`${t.outboundDate}T${t.outboundTime || '00:00'}:00`);
        const inDT  = new Date(`${t.inboundDate}T${t.inboundTime || '00:00'}:00`);
        const build = (s, d, ti, ad, at, fn, dt, f, to) => ({ id: t.id + s, ticket: t, date: d, time: ti, arrivalDate: ad, arrivalTime: at, flightNo: fn, dateTime: dt, from: f, to: to });

        if (t.type === 'normal') {
            if (t.outboundDate) segments.push(build('-1', t.outboundDate, t.outboundTime, t.outboundArrivalDate, t.outboundArrivalTime, t.outboundFlightNo, outDT, t.departRegion, t.returnRegion));
            if (t.inboundDate)  segments.push(build('-2', t.inboundDate,  t.inboundTime, t.inboundArrivalDate, t.inboundArrivalTime, t.inboundFlightNo, inDT,  t.returnRegion, t.departRegion));
        } else if (t.type === 'reverse') {
            if (t.outboundDate) segments.push(build('-1', t.outboundDate, t.outboundTime, t.outboundArrivalDate, t.outboundArrivalTime, t.outboundFlightNo, outDT, t.returnRegion, t.departRegion));
            if (t.inboundDate)  segments.push(build('-2', t.inboundDate,  t.inboundTime, t.inboundArrivalDate, t.inboundArrivalTime, t.inboundFlightNo, inDT,  t.departRegion, t.returnRegion));
        } else {
            if (t.outboundDate) segments.push(build('-1', t.outboundDate, t.outboundTime, t.outboundArrivalDate, t.outboundArrivalTime, t.outboundFlightNo, outDT, t.departRegion, t.returnRegion));
        }
    });

    segments.sort((a, b) => a.dateTime - b.dateTime);
    const matchedHotelIds = new Set();
    const matchedActivityIds = new Set();
    const flightTrips = [];
    let currentTrip = null;

    segments.forEach(seg => {
        if (!currentTrip) {
            currentTrip = { id: seg.id, segments: [seg], isComplete: isTaiwan(seg.to) };
            if (currentTrip.isComplete) { flightTrips.push(currentTrip); currentTrip = null; }
        } else {
            currentTrip.segments.push(seg);
            if (isTaiwan(seg.to)) { currentTrip.isComplete = true; flightTrips.push(currentTrip); currentTrip = null; }
            else if (isTaiwan(seg.from)) { flightTrips.push(currentTrip); currentTrip = { id: seg.id, segments: [seg], isComplete: false }; }
        }
    });
    if (currentTrip) flightTrips.push(currentTrip);

    // 2. 裝飾機票行程並偵測孤兒
    const itineraries = flightTrips.map(trip => {
        const segs = trip.segments;
        const start = segs[0].date;
        const end = segs[segs.length - 1].date;
        const tripHotels = hotels.filter(h => {
            const isMatch = h.checkIn && h.checkOut && h.checkIn < end && h.checkOut > start;
            if (isMatch) matchedHotelIds.add(h.id);
            return isMatch;
        });
        const tripActs = activities.filter(a => {
            const isMatch = a.startDate <= end && (a.endDate || a.startDate) >= start;
            if (isMatch) matchedActivityIds.add(a.id);
            return isMatch;
        });

        const warns = [];
        let reqStart = start;
        if (isTaiwan(segs[0].from) && segs[0].arrivalDate && segs[0].arrivalDate > start) reqStart = segs[0].arrivalDate;
        const tripDays = Math.ceil((new Date(end) - new Date(start)) / 86400000) + 1;
        if (tripDays > 1 && tripHotels.length === 0) warns.push('⚠️ 此趟次尚未安排任何住宿');
        const sortedH = [...tripHotels].sort((a, b) => a.checkIn.localeCompare(b.checkIn));
        for (let i = 0; i < sortedH.length - 1; i++) {
            if (sortedH[i+1].checkIn < sortedH[i].checkOut) warns.push(`⚠️ 住宿重疊：「${sortedH[i].name}」與「${sortedH[i+1].name}」`);
            else if (sortedH[i+1].checkIn > sortedH[i].checkOut) warns.push(`⚠️ 住宿缺口：${sortedH[i].checkOut} 到 ${sortedH[i+1].checkIn} 之間無住宿`);
        }
        if (sortedH.length > 0) {
            if (sortedH[0].checkIn > reqStart) warns.push(`⚠️ 住宿缺口：${reqStart} 到 ${sortedH[0].checkIn} 之間無住宿`);
            if (sortedH[sortedH.length - 1].checkOut < end) warns.push(`⚠️ 住宿缺口：${sortedH[sortedH.length - 1].checkOut} 到 ${end} 之間無住宿`);
        }
        return { ...trip, start, end, hotels: tripHotels, activities: tripActs, warnings: warns, isVirtual: false };
    });

    const orphans = [
        ...hotels.filter(h => !matchedHotelIds.has(h.id)).map(h => ({ start: h.checkIn, end: h.checkOut, hotels: [h], activities: [], warnings: [], isVirtual: true, label: `🏨 ${h.name}` })),
        ...activities.filter(a => !matchedActivityIds.has(a.id)).map(a => ({ start: a.startDate, end: a.endDate || a.startDate, hotels: [], activities: [a], warnings: [], isVirtual: true, label: `🎫 ${a.title}` }))
    ];

    return [...itineraries, ...orphans].sort((a, b) => a.start.localeCompare(b.start));
}

// ==========================================
// 2. 文字訊息渲染邏輯
// ==========================================
const renderTripText = (trip, tripLabels) => {
    const isVirtual = trip.isVirtual;
    const segments = trip.segments || [];
    const hotels = trip.hotels || [];
    const repoLabel = process.env.GITHUB_REPOSITORY ? `[${process.env.GITHUB_REPOSITORY.split('/')[1]}] ` : '';
    const label = isVirtual ? (trip.label || "未命名項目") : (tripLabels[trip.id] || `${(segments[0]?.to || "未知").split(' ')[0]} 趟次`);
    const dateRange = (trip.start === trip.end) ? (trip.start || "未知日期") : `${trip.start} ~ ${trip.end}`;

    let msg = `${repoLabel}${isVirtual ? '獨立項目' : '行程提醒'}：${label}\n`;
    msg += `📅 ${dateRange}\n`;

    if (trip.warnings?.length > 0) {
        msg += `\n🚨 警告：\n`;
        trip.warnings.forEach(w => msg += `${w}\n`);
    }

    if (segments.length > 0) {
        msg += `\n✈️ 航班資訊：\n`;
        segments.forEach(s => {
            const timeLabel = s.time ? ` (${s.time})` : '';
            msg += `- ${s.flightNo || '航班'}${timeLabel} | ${(s.from || "??").split(' ')[0]} ➔ ${(s.to || "??").split(' ')[0]}\n`;
            if (s.flightNo) {
                msg += `  追蹤: https://zh.flightaware.com/live/flight/${s.flightNo.replace(/\s+/g, '')}\n`;
            }
        });
    }

    if (hotels.length > 0) {
        msg += `\n🏨 住宿資訊：\n`;
        hotels.forEach(h => {
            msg += `- ${h.name}\n`;
            msg += `  時間: ${h.checkIn} ➔ ${h.checkOut}\n`;
            if (h.address) msg += `  地址: ${h.address}\n`;
        });
    }

    msg += `\n🔗 查看完整行程: https://imhahac.github.io/reverse-ticket-manager/`;
    return msg;
};

// ==========================================
// 3. 執行主體
// ==========================================
const run = async () => {
    console.log("🚀 LINE Bot v2 Starting (Text Mode)...");
    try {
        const client_id = process.env.GOOGLE_CLIENT_ID;
        const client_secret = process.env.GOOGLE_CLIENT_SECRET;
        const refresh_token = process.env.GOOGLE_REFRESH_TOKEN;

        if (!client_id || !client_secret || !refresh_token) {
            throw new Error("Missing Google OAuth credentials.");
        }

        const oauth2Client = new google.auth.OAuth2(client_id, client_secret);
        oauth2Client.setCredentials({ refresh_token });

        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        console.log("🔍 Searching for reverse-tickets.json...");
        
        const listRes = await drive.files.list({ q: 'name="reverse-tickets.json" and trashed=false', fields: 'files(id, name)' });
        const files = listRes.data.files;
        if (!files?.length) { console.log("⚠️ No data file found."); return; }

        const fileRes = await drive.files.get({ fileId: files[0].id, alt: 'media' });
        const data = fileRes.data;
        const tickets = Array.isArray(data) ? data : (data.tickets || []);
        const hotels = data.hotels || [];
        const activities = data.activities || [];
        const tripLabels = data.tripLabels || {};

        const allItineraries = getItinerary(tickets, hotels, activities);
        
        const targetDate = process.env.TEST_DATE || format(new Date(), 'yyyy-MM-dd');
        const d0 = targetDate;
        const d1 = format(addDays(parseISO(targetDate), 1), 'yyyy-MM-dd');
        const d3 = format(addDays(parseISO(targetDate), 3), 'yyyy-MM-dd');
        const d7_limit = format(addDays(parseISO(targetDate), 7), 'yyyy-MM-dd');

        const notifyTrips = allItineraries.filter(trip => {
            const isStartMatch = [d0, d1, d3].includes(trip.start);
            const isDangerNear = (trip.start >= d0 && trip.start <= d7_limit && trip.warnings?.length > 0);
            return isStartMatch || isDangerNear;
        });

        if (notifyTrips.length === 0) {
            console.log("✅ No matching notifications for today.");
            return;
        }

        console.log(`🔔 Found ${notifyTrips.length} itineraries to notify.`);
        const messages = notifyTrips.map(t => ({
            type: "text",
            text: renderTripText(t, tripLabels)
        }));

        const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
        const lineUser = process.env.LINE_USER_ID;
        
        // 分開傳送每一則訊息 (或組合在一起)
        // 這裡採用分開傳送，讓每個行程獨立一則訊息以便閱讀
        for (const msg of messages) {
            await axios.post('https://api.line.me/v2/bot/message/push', { to: lineUser, messages: [msg] }, {
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${lineToken}` }
            });
        }

        console.log("✨ Text notifications sent successfully.");
    } catch (e) {
        console.error("❌ Error:", e.message);
        process.exit(1);
    }
};

run();
