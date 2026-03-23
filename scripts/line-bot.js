import { google } from 'googleapis';
import axios from 'axios';
import { format, addDays } from 'date-fns';

// 簡易 IATA → IANA 時區 mapping，供推播顯示用
function getIanaTimeZoneForSegment(seg) {
    const codeFrom = (seg.from || '').split(' ')[0];
    const codeTo   = (seg.to || '').split(' ')[0];

    const table = {
        // 台灣
        TPE: 'Asia/Taipei',
        TSA: 'Asia/Taipei',
        KHH: 'Asia/Taipei',
        RMQ: 'Asia/Taipei',
        // 日本
        NRT: 'Asia/Tokyo',
        HND: 'Asia/Tokyo',
        KIX: 'Asia/Tokyo',
        CTS: 'Asia/Tokyo',
        FUK: 'Asia/Tokyo',
        OKA: 'Asia/Tokyo',
        // 泰國
        BKK: 'Asia/Bangkok',
        DMK: 'Asia/Bangkok',
        // 新加坡
        SIN: 'Asia/Singapore',
        // 香港
        HKG: 'Asia/Hong_Kong',
    };

    return table[codeFrom] || table[codeTo] || 'Asia/Taipei';
}

// ==========================================
// Trip & Hotel Logic Re-implemented for Node.js
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

const calculateTripDays = (startDate, endDate) => {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start) || isNaN(end)) return null;
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
};

function getTrips(tickets) {
    const safeTickets = tickets.filter(t => t && typeof t === 'object' && t.id);
    const segments = [];
    safeTickets.forEach(t => {
        const outDateTime = new Date(`${t.outboundDate}T${t.outboundTime || '00:00'}:00`);
        const inDateTime  = new Date(`${t.inboundDate}T${t.inboundTime || '00:00'}:00`);

        const buildSeg = (suffix, date, time, arrDate, arrTime, flightNo, dt, from, to) => ({
            id: t.id + suffix, ticket: t, date, time, arrivalDate: arrDate || '', arrivalTime: arrTime || '', flightNo: flightNo || '', dateTime: dt, from, to
        });

        if (t.type === 'normal') {
            if (t.outboundDate) segments.push(buildSeg('-1', t.outboundDate, t.outboundTime, t.outboundArrivalDate, t.outboundArrivalTime, t.outboundFlightNo, outDateTime, t.departRegion, t.returnRegion));
            if (t.inboundDate)  segments.push(buildSeg('-2', t.inboundDate,  t.inboundTime, t.inboundArrivalDate, t.inboundArrivalTime, t.inboundFlightNo, inDateTime,  t.returnRegion, t.departRegion));
        } else if (t.type === 'reverse') {
            if (t.outboundDate) segments.push(buildSeg('-1', t.outboundDate, t.outboundTime, t.outboundArrivalDate, t.outboundArrivalTime, t.outboundFlightNo, outDateTime, t.returnRegion, t.departRegion));
            if (t.inboundDate)  segments.push(buildSeg('-2', t.inboundDate,  t.inboundTime, t.inboundArrivalDate, t.inboundArrivalTime, t.inboundFlightNo, inDateTime,  t.departRegion, t.returnRegion));
        } else {
            if (t.outboundDate) segments.push(buildSeg('-1', t.outboundDate, t.outboundTime, t.outboundArrivalDate, t.outboundArrivalTime, t.outboundFlightNo, outDateTime, t.departRegion, t.returnRegion));
        }
    });

    segments.sort((a, b) => a.dateTime - b.dateTime);

    let trips = [];
    let currentTrip = null;

    segments.forEach(seg => {
        if (!currentTrip) {
            currentTrip = { id: seg.id, outbound: seg, connections: [], inbound: null, isComplete: false };
            if (isTaiwan(seg.to)) {
                currentTrip.inbound  = seg;
                currentTrip.outbound = null;
                currentTrip.isComplete = true;
                trips.push(currentTrip);
                currentTrip = null;
            }
        } else {
            if (isTaiwan(seg.to)) {
                currentTrip.inbound = seg;
                currentTrip.isComplete = true;
                trips.push(currentTrip);
                currentTrip = null;
            } else if (isTaiwan(seg.from)) {
                trips.push(currentTrip);
                currentTrip = { id: seg.id, outbound: seg, connections: [], inbound: null, isComplete: false };
            } else {
                currentTrip.connections.push(seg);
            }
        }
    });
    if (currentTrip) trips.push(currentTrip);

    return trips.map(trip => {
        const segs = [
            ...(trip.outbound ? [trip.outbound] : []),
            ...trip.connections,
            ...(trip.inbound  ? [trip.inbound]  : []),
        ];
        return { ...trip, segments: segs };
    });
}

function getHotelWarnings(trip, allHotels) {
    const segs = trip.segments || [];
    if (!segs.length || !allHotels.length) {
        if (segs.length > 0 && calculateTripDays(segs[0].date, segs[segs.length-1].date) > 1) {
            return ['⚠️ 此趟次尚未安排任何住宿'];
        }
        return [];
    }

    const tripStartDate = segs[0]?.date;
    const tripEndDate   = segs[segs.length - 1]?.date;
    
    let reqStart = tripStartDate;
    const reqEnd = tripEndDate;
    if (segs.length > 0 && isTaiwan(segs[0].from) && segs[0].arrivalDate && segs[0].arrivalDate > tripStartDate) {
        reqStart = segs[0].arrivalDate;
    }
    
    if (!tripStartDate || !tripEndDate) return [];

    const matchedHotels = allHotels.filter(h =>
        h.checkIn  && h.checkOut &&
        h.checkIn  < tripEndDate &&
        h.checkOut > tripStartDate
    );

    const warns = [];
    const tripDays = calculateTripDays(tripStartDate, tripEndDate) || 0;

    if (reqStart >= reqEnd) return warns;

    if (tripDays > 1 && matchedHotels.length === 0) {
        warns.push('⚠️ 此趟次尚未安排任何住宿');
        return warns;
    }

    const valid = [...matchedHotels]
        .filter(h => h.checkIn && h.checkOut)
        .sort((a, b) => a.checkIn.localeCompare(b.checkIn));

    for (let i = 0; i < valid.length - 1; i++) {
        const a = valid[i], b = valid[i + 1];
        if (b.checkIn < a.checkOut) {
            warns.push(`⚠️ 住宿重疊：「${a.name}」與「${b.name}」`);
        } else if (b.checkIn > a.checkOut) {
            warns.push(`⚠️ 住宿缺口：${a.checkOut} 到 ${b.checkIn} 之間無住宿`);
        }
    }

    if (valid.length > 0) {
        if (valid[0].checkIn > reqStart) {
            warns.push(`⚠️ 住宿缺口：${reqStart} 到 ${valid[0].checkIn} 之間無住宿`);
        }
        if (valid[valid.length - 1].checkOut < reqEnd) {
            warns.push(`⚠️ 住宿缺口：${valid[valid.length - 1].checkOut} 到 ${reqEnd} 之間無住宿`);
        }
    }

    const uniqueCodes = [...new Set(segs.flatMap(s => [s.from?.split(' ')[0], s.to?.split(' ')[0]]))]
        .filter(code => code && !isTaiwan(code));
    
    if (uniqueCodes.length > 0 && valid.length > 0) {
        valid.forEach(h => {
            // 精確經緯度距離比對 (大於 120km 警告)
            if (h.lat && h.lng) {
                let minDistance = Infinity;
                let nearestAirport = null;
                uniqueCodes.forEach(code => {
                    const coords = AIRPORT_COORDINATES[code];
                    if (coords) {
                        const dist = getDistanceFromLatLonInKm(h.lat, h.lng, coords.lat, coords.lng);
                        if (dist !== null && dist < minDistance) {
                            minDistance = dist;
                            nearestAirport = code;
                        }
                    }
                });
                if (minDistance !== Infinity && minDistance > 120) {
                    warns.push(`⚠️ 地點落差警告：「${h.name}」距離最近的機場 (${nearestAirport}) 達 ${Math.round(minDistance)} 公里，請確認是否訂錯國家或城市`);
                }
            }
        });
    }

    return warns;
}
// ==========================================


const run = async () => {
    console.log("Starting LINE Bot Cron Job...");
    try {
        const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS;
        if (!credentialsJson) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_CREDENTIALS");
        
        let credentials;
        try {
            // 先 trim，去除 Secret 前後可能多出的空白/換行
            const raw = credentialsJson.trim();
            credentials = JSON.parse(raw);
        } catch (e) {
            // 常見問題：GitHub Secret 貼入時 private_key 裡的 \n 被展開成真正換行
            // 嘗試修復：把真正的換行還原成 \n 再 parse
            try {
                const fixed = credentialsJson
                    .trim()
                    // 把 JSON 字串值內的實際換行（key 欄位內）還原為 \n 跳脫字元
                    // 策略：只處理 "-----BEGIN ... KEY-----" 區塊內的換行
                    .replace(/("private_key"\s*:\s*")([\s\S]*?)(")/g, (_, pre, key, post) =>
                        pre + key.replace(/\n/g, '\\n') + post
                    );
                credentials = JSON.parse(fixed);
                console.log('GOOGLE_SERVICE_ACCOUNT_CREDENTIALS: 已自動修復 private_key 換行問題');
            } catch (e2) {
                // 印出前 120 字元協助 Debug
                const preview = credentialsJson.slice(0, 120).replace(/\n/g, '↵');
                throw new Error(
                    `GOOGLE_SERVICE_ACCOUNT_CREDENTIALS 無法解析為 JSON。\n` +
                    `原始錯誤: ${e.message}\n` +
                    `內容預覽（前120字）: ${preview}\n\n` +
                    `請確認 GitHub Secret 貼入的是完整的服務帳戶 JSON 金鑰檔內容。`
                );
            }
        }

        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/drive.readonly']
        });

        const drive = google.drive({ version: 'v3', auth });

        console.log("Searching for reverse-tickets.json in Google Drive...");
        const res = await drive.files.list({
            q: 'name="reverse-tickets.json" and trashed=false',
            fields: 'files(id, name)',
        });

        const files = res.data.files;
        if (!files || files.length === 0) {
            console.log('No reverse-tickets.json found.');
            return;
        }

        const fileId = files[0].id;
        console.log(`File found with ID: ${fileId}. Downloading...`);

        const fileRes = await drive.files.get({
            fileId: fileId,
            alt: 'media'
        });

        const data = fileRes.data;
        let tickets = [];
        let hotels = [];
        let tripLabels = {};
        if (Array.isArray(data)) {
            tickets = data;
        } else {
            tickets = data.tickets || [];
            hotels = data.hotels || [];
            tripLabels = data.tripLabels || {};
        }

        if (tickets.length === 0) {
            console.log('No tickets found in the configuration.');
            return;
        }

        // Process segments
        const allSegments = [];
        tickets.forEach(t => {
            if (t.type === 'normal') {
                if(t.outboundDate) allSegments.push({ date: t.outboundDate, time: t.outboundTime, from: t.departRegion, to: t.returnRegion, airline: t.airline, flightNo: t.outboundFlightNo });
                if(t.inboundDate) allSegments.push({ date: t.inboundDate, time: t.inboundTime, from: t.returnRegion, to: t.departRegion, airline: t.airline, flightNo: t.inboundFlightNo });
            } else if (t.type === 'reverse') {
                if(t.outboundDate) allSegments.push({ date: t.outboundDate, time: t.outboundTime, from: t.returnRegion, to: t.departRegion, airline: t.airline, flightNo: t.outboundFlightNo });
                if(t.inboundDate) allSegments.push({ date: t.inboundDate, time: t.inboundTime, from: t.departRegion, to: t.returnRegion, airline: t.airline, flightNo: t.inboundFlightNo });
            } else {
                if(t.outboundDate) allSegments.push({ date: t.outboundDate, time: t.outboundTime, from: t.departRegion, to: t.returnRegion, airline: t.airline, flightNo: t.outboundFlightNo });
            }
        });

        const today = new Date();
        const todayStr = format(today, 'yyyy-MM-dd');
        const tmrStr = format(addDays(today, 1), 'yyyy-MM-dd');
        const in3DaysStr = format(addDays(today, 3), 'yyyy-MM-dd');

        let messages = [];

        allSegments.forEach(seg => {
            const tz = getIanaTimeZoneForSegment(seg);
            const timeStr = seg.time ? ` ${seg.time}（${tz}）` : '';
            const flightLabel = seg.flightNo ? `${seg.airline} (${seg.flightNo})` : seg.airline;
            
            if (seg.date === in3DaysStr) {
                messages.push(`【行前準備提醒】\n三天後即將出發！\n✈️ 航班: ${flightLabel}\n📍 路線: ${seg.from} ➔ ${seg.to}\n📅 日期: ${seg.date}${timeStr}\n記得再次確認行李與相關證件喔！\n🔗 查看訂單: https://imhahac.github.io/reverse-ticket-manager/`);
            } else if (seg.date === tmrStr) {
                messages.push(`【即將啟程】\n明天就要飛囉！\n✈️ 航班: ${flightLabel}\n📍 路線: ${seg.from} ➔ ${seg.to}\n📅 日期: ${seg.date}${timeStr}\n祝您旅途愉快、平安順心！\n🔗 查看訂單: https://imhahac.github.io/reverse-ticket-manager/`);
            } else if (seg.date === todayStr) {
                messages.push(`【今日出發】\n就是今天！\n✈️ 航班: ${flightLabel}\n📍 路線: ${seg.from} ➔ ${seg.to}\n📅 日期: ${seg.date}${timeStr}\n準備好報到手續了嗎？出發吧！\n🔗 查看訂單: https://imhahac.github.io/reverse-ticket-manager/`);
            }
        });

        // 住宿缺口警告 (未來 7 天內出發的行程)
        const in7Days = new Date();
        in7Days.setDate(in7Days.getDate() + 7);
        const todayZero = new Date();
        todayZero.setHours(0,0,0,0);

        const trips = getTrips(tickets);
        trips.forEach(trip => {
            if (!trip.segments || trip.segments.length === 0) return;
            const startDateStr = trip.segments[0].date;
            const startDate = new Date(startDateStr);
            
            // 如果行程出發日介於今天到未來 7 天內
            if (startDate >= todayZero && startDate <= in7Days) {
                const warnings = getHotelWarnings(trip, hotels);
                if (warnings.length > 0) {
                    const label = tripLabels[trip.id] || `${(trip.segments[0].to || '').split(' ')[0]} 行程`;
                    let msg = `🚨 【飯店缺房警告】🚨\n您即將於 ${startDateStr} 出發的「${label}」發現以下住宿問題：\n`;
                    warnings.forEach(w => msg += `${w}\n`);
                    msg += `\n請盡速確認並完成訂單！\n🔗 前往補訂: https://imhahac.github.io/reverse-ticket-manager/`;
                    messages.push(msg);
                }
            }
        });

        if (messages.length > 0) {
            console.log(`Found ${messages.length} flights to notify.`);
            
            const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
            const lineUserId = process.env.LINE_USER_ID;
            
            if (!lineToken || !lineUserId) {
                throw new Error("Missing LINE credentials in environment variables.");
            }

            const combinedText = messages.join('\n\n-----------------\n\n');
            
            console.log("Sending Push Notification to LINE...");
            await axios.post('https://api.line.me/v2/bot/message/push', {
                to: lineUserId,
                messages: [{ type: 'text', text: combinedText }]
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${lineToken}`
                }
            });

            console.log(`Push notification sent successfully.`);
        } else {
            console.log('No flights matching notification criteria today.');
        }

    } catch (e) {
        console.error('Error running cron job:', e);
        process.exit(1);
    }
};

run();
