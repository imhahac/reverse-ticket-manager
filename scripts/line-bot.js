import { google } from 'googleapis';
import axios from 'axios';
import { format, addDays, parseISO } from 'date-fns';

/**
 * LINE Bot Cron Job v2
 * 🚀 支持 OAuth2 認證
 * 🚀 支持 虛擬行程 (Virtual Trips) 偵測
 * 🚀 支持 Flex Message 高質感通知
 */

// ==========================================
// 1. 核心邏輯共享區 (由前端邏輯移植)
// ==========================================
const TW_CODES = ['TPE', 'TSA', 'KHH', 'RMQ'];
const isTaiwan = (regionStr) => {
    if (!regionStr) return false;
    return TW_CODES.some(code => regionStr.includes(code));
};

const AIRPORT_COORDINATES = {
    'TPE': { lat: 25.0797, lng: 121.2342 }, 'TSA': { lat: 25.0697, lng: 121.5526 },
    'KHH': { lat: 22.5771, lng: 120.3500 }, 'RMQ': { lat: 24.2646, lng: 120.6209 },
    'NRT': { lat: 35.7647, lng: 140.3863 }, 'HND': { lat: 35.5494, lng: 139.7798 },
    'KIX': { lat: 34.4320, lng: 135.2304 }, 'ITM': { lat: 34.7855, lng: 135.4382 },
    'NGO': { lat: 34.8583, lng: 136.8054 }, 'CTS': { lat: 42.7849, lng: 141.6708 },
    'HKD': { lat: 41.7735, lng: 140.8166 }, 'FUK': { lat: 33.5859, lng: 130.4507 },
    'OKA': { lat: 26.1958, lng: 127.6525 }, 'BKK': { lat: 13.6900, lng: 100.7501 },
    'DMK': { lat: 13.9126, lng: 100.6068 }, 'CNX': { lat: 18.7668, lng: 98.9626 },
    'HKT': { lat: 8.1111, lng: 98.3065 },   'SIN': { lat: 1.3644, lng: 103.9915 },
    'HKG': { lat: 22.3080, lng: 113.9185 }, 'MFM': { lat: 22.1496, lng: 113.5915 },
    'ICN': { lat: 37.4602, lng: 126.4407 }, 'GMP': { lat: 37.5619, lng: 126.8010 },
    'PUS': { lat: 35.1732, lng: 128.9463 }, 'CJU': { lat: 33.5113, lng: 126.4930 }
};

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
              Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c;
}

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

        // 警告邏輯
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

    // 3. 虛擬行程 (孤兒)
    const orphans = [
        ...hotels.filter(h => !matchedHotelIds.has(h.id)).map(h => ({ start: h.checkIn, end: h.checkOut, hotels: [h], activities: [], warnings: [], isVirtual: true, label: `🏨 ${h.name}` })),
        ...activities.filter(a => !matchedActivityIds.has(a.id)).map(a => ({ start: a.startDate, end: a.endDate || a.startDate, hotels: [], activities: [a], warnings: [], isVirtual: true, label: `🎫 ${a.title}` }))
    ];

    return [...itineraries, ...orphans].sort((a, b) => a.start.localeCompare(b.start));
}

// ==========================================
// 2. LINE Flex Message 模板
// ==========================================
const createFlexMessage = (altText, contents) => ({
    type: "flex",
    altText,
    contents: {
        type: "carousel",
        contents: contents.slice(0, 10) // LINE 限制最多 10 個卡片
    }
});

const renderTripBubble = (trip, tripLabels) => {
    const isVirtual = trip.isVirtual;
    const segments = trip.segments || [];
    const hotels = trip.hotels || [];
    const repoLabel = process.env.GITHUB_REPOSITORY ? `[${process.env.GITHUB_REPOSITORY.split('/')[1]}] ` : '';
    const label = isVirtual ? (trip.label || "未命名項目") : (tripLabels[trip.id] || `${(segments[0]?.to || "未知").split(' ')[0]} 趟次`);
    const dateRange = (trip.start === trip.end) ? (trip.start || "未知日期") : `${trip.start} ~ ${trip.end}`;
    const headerColor = isVirtual ? "#8B5CF6" : ((trip.warnings?.length > 0) ? "#F59E0B" : "#10B981");

    // 1. 警告區塊
    const warningNodes = (trip.warnings || []).map(w => ({
        type: "text", text: w, size: "xxs", color: "#DC2626", margin: "md", wrap: true, weight: "bold"
    }));

    // 2. 航段區塊 (含 FlightAware)
    let segmentNodes = segments.map(s => {
        const flightLabel = s.flightNo ? `✈️ ${s.flightNo}` : '✈️ 航班';
        const timeLabel = s.time ? ` (${s.time})` : '';
        const flightAwareUrl = s.flightNo ? `https://zh.flightaware.com/live/flight/${s.flightNo.replace(/\s+/g, '')}` : null;
        
        return {
            type: "box", layout: "vertical", margin: "md",
            contents: [
                {
                    type: "box", layout: "horizontal", contents: [
                        { type: "text", text: flightLabel + timeLabel, size: "xs", color: "#4B5563", flex: 3, weight: "bold", 
                          action: flightAwareUrl ? { type: "uri", label: "FlightAware", uri: flightAwareUrl } : undefined,
                          decoration: flightAwareUrl ? "underline" : "none" },
                        { type: "text", text: `${(s.from || "??").split(' ')[0]} ➔ ${(s.to || "??").split(' ')[0]}`, size: "xs", color: "#111111", align: "end", flex: 4 }
                    ]
                }
            ]
        };
    });

    // 3. 住宿區塊
    const hotelNodes = hotels.map(h => ({
        type: "box", layout: "vertical", margin: "md", spacing: "xs",
        contents: [
            { type: "text", text: `🏨 ${h.name}`, size: "sm", weight: "bold", color: "#111111", wrap: true },
            { type: "text", text: `📅 ${h.checkIn} ➔ ${h.checkOut}`, size: "xxs", color: "#666666" },
            { type: "text", text: `📍 ${h.address || '無地址資訊'}`, size: "xxs", color: "#999999", wrap: true }
        ]
    }));

    // 整合列表
    let listNodes = [];
    if (segmentNodes.length > 0) {
        listNodes.push({ type: "text", text: "航班資訊", size: "xs", weight: "bold", color: "#999999", margin: "md" });
        listNodes.push(...segmentNodes);
    }
    if (hotelNodes.length > 0) {
        if (listNodes.length > 0) listNodes.push({ type: "separator", margin: "lg" });
        listNodes.push({ type: "text", text: "住宿資訊", size: "xs", weight: "bold", color: "#999999", margin: "md" });
        listNodes.push(...hotelNodes);
    }

    if (listNodes.length === 0) {
        listNodes = [{ type: "text", text: "（無詳細查驗資訊）", size: "xs", color: "#999999", style: "italic" }];
    }

    return {
        type: "bubble",
        size: "mega",
        header: {
            type: "box", layout: "vertical", backgroundColor: headerColor,
            contents: [
                { type: "text", text: isVirtual ? "獨立項目" : "行程通知", color: "#ffffff", size: "xs", weight: "bold" },
                { type: "text", text: repoLabel + label, color: "#ffffff", size: "lg", weight: "bold", margin: "xs", wrap: true }
            ]
        },
        body: {
            type: "box", layout: "vertical", spacing: "md",
            contents: [
                { type: "box", layout: "horizontal", contents: [{ type: "text", text: "📅 行程日期", size: "sm", color: "#666666", flex: 3 }, { type: "text", text: dateRange, size: "sm", color: "#111111", flex: 7, weight: "bold", align: "end" }] },
                ...warningNodes,
                { type: "separator", margin: "lg" },
                { type: "box", layout: "vertical", contents: listNodes }
            ]
        },
        footer: {
            type: "box", layout: "vertical",
            contents: [{ type: "button", action: { type: "uri", label: "點此打開 App 查看", uri: "https://imhahac.github.io/reverse-ticket-manager/" }, style: "primary", color: headerColor }]
        }
    };
};

// ==========================================
// 3. 執行主體
// ==========================================
const run = async () => {
    console.log("🚀 LINE Bot v2 Starting...");
    try {
        const client_id = process.env.GOOGLE_CLIENT_ID;
        const client_secret = process.env.GOOGLE_CLIENT_SECRET;
        const refresh_token = process.env.GOOGLE_REFRESH_TOKEN;

        if (!client_id || !client_secret || !refresh_token) {
            throw new Error("Missing Google OAuth credentials (ID, Secret, or Refresh Token).");
        }

        const oauth2Client = new google.auth.OAuth2(client_id, client_secret);
        oauth2Client.setCredentials({ refresh_token });

        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        console.log("🔍 Searching for reverse-tickets.json...");
        
        const listRes = await drive.files.list({ q: 'name="reverse-tickets.json" and trashed=false', fields: 'files(id, name)' });
        const files = listRes.data.files;
        if (!files?.length) { console.log("⚠️ No data file found."); return; }

        const fileRes = await drive.files.get({ fileId: files[0].id, alt: 'media' });
        const rawData = fileRes.data;
        const tickets = Array.isArray(rawData) ? rawData : (rawData.tickets || []);
        const hotels = rawData.hotels || [];
        const activities = rawData.activities || [];
        const tripLabels = rawData.tripLabels || {};

        const allItineraries = getItinerary(tickets, hotels, activities);
        
        // 判定哪些需要通知
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
        const flexBubbles = notifyTrips.map(t => renderTripBubble(t, tripLabels));
        const payload = createFlexMessage("✈️ 您的旅程提醒", flexBubbles);

        // [Debug] 列印完整 Payload 以便除錯
        console.log("--- START LINE PAYLOAD ---");
        console.log(JSON.stringify(payload, null, 2));
        console.log("--- END LINE PAYLOAD ---");

        const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
        const lineUser = process.env.LINE_USER_ID;
        
        await axios.post('https://api.line.me/v2/bot/message/push', { to: lineUser, messages: [payload] }, {
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${lineToken}` }
        });

        console.log("✨ Notifications sent successfully.");
    } catch (e) {
        if (e.response && e.response.data) {
            console.error("❌ LINE API Error Details:", JSON.stringify(e.response.data, null, 2));
        } else {
            console.error("❌ Error:", e.message);
        }
        process.exit(1);
    }
};

run();
