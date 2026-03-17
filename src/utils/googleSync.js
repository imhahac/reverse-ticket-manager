// src/utils/googleSync.js

/**
 * 上傳/覆寫資料到 Google Drive 的 reverse-tickets.json
 * @param {Array}  tickets    - 機票資料
 * @param {Object} tripLabels - 行程標籤
 * @param {Array}  hotels     - 飯店住宿資料
 * @param {string} accessToken
 */
export const syncToDrive = async (tickets, tripLabels, hotels = [], accessToken) => {
    try {
        const query = encodeURIComponent(`name="reverse-tickets.json" and trashed=false`);
        const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        if (searchRes.status === 401) return { success: false, expired: true };
        if (!searchRes.ok) throw new Error(`搜尋 Drive 失敗: [${searchRes.status}] ${await searchRes.text()}`);

        const searchData = await searchRes.json();
        const existingFile = searchData.files && searchData.files.length > 0 ? searchData.files[0] : null;

        const fileContent = { tickets, tripLabels, hotels };

        let uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=media';
        let method = 'POST';
        
        if (existingFile) {
            uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`;
            method = 'PATCH';
        }

        const res = await fetch(uploadUrl, {
            method,
            headers: { 
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(fileContent)
        });

        // If it's a new file (POST), we also need to set the filename metadata
        if (method === 'POST' && res.ok) {
            const uploadedData = await res.json();
            await fetch(`https://www.googleapis.com/drive/v3/files/${uploadedData.id}`, {
                method: 'PATCH',
                headers: { 
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: 'reverse-tickets.json' })
            });
            return { success: true, fileId: uploadedData.id };
        } else if (res.ok) {
            const resData = await res.json();
            return { success: true, fileId: resData.id };
        } else {
            if (res.status === 401) return { success: false, expired: true };
            throw new Error(`上傳檔案失敗: [${res.status}] ${await res.text()}`);
        }
    } catch (e) {
        console.error(e);
        return { success: false, error: e.message };
    }
};

/**
 * 從 Google Drive 下載 reverse-tickets.json
 */
export const loadFromDrive = async (accessToken) => {
    try {
        const query = encodeURIComponent(`name="reverse-tickets.json" and trashed=false`);
        const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        if (searchRes.status === 401) return { success: false, expired: true };
        if (!searchRes.ok) {
            throw new Error(`搜尋 Drive 失敗: [${searchRes.status}] ${await searchRes.text()}`);
        }

        const searchData = await searchRes.json();
        
        if (!searchData.files || searchData.files.length === 0) {
            return { success: false, error: `雲端找不到 reverse-tickets.json 的檔案。\n近期您是否有清除資料或變更帳號？` };
        }

        const existingFile = searchData.files[0];
        const allFoundFiles = searchData.files.map(f => `${f.name} (ID: ${f.id})`).join('\n');

        const downloadRes = await fetch(`https://www.googleapis.com/drive/v3/files/${existingFile.id}?alt=media`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        if (downloadRes.status === 401) return { success: false, expired: true };
        if (!downloadRes.ok) {
            throw new Error(`下載 Content 失敗: [${downloadRes.status}] ${await downloadRes.text()}`);
        }
        
        const data = await downloadRes.json();
        
        let tickets = [];
        let tripLabels = {};
        let hotels = [];
        
        if (Array.isArray(data)) {
            tickets = data;
        } else {
            tickets = data.tickets || [];
            tripLabels = data.tripLabels || {};
            hotels = data.hotels || [];
        }

        return { success: true, tickets, tripLabels, hotels, foundFilesLog: allFoundFiles };
    } catch (e) {
        console.error(e);
        return { success: false, error: e.message };
    }
};

/**
 * 將 "YYYY-MM-DDTHH:MM:SS" 字串加上 N 小時，回傳相同格式
 * （不含 offset/timezone，讓 Google Calendar 用 timeZone 欄位解析）
 */
function addHoursToLocalStr(localStr, hours) {
    // localStr: "2025-06-15T13:40:00"
    const [datePart, timePart] = localStr.split('T');
    const [h, m, s] = timePart.split(':').map(Number);
    let totalMinutes = h * 60 + m + hours * 60;
    const newH = Math.floor(totalMinutes / 60) % 24;
    const newM = totalMinutes % 60;
    // If hours overflow to next day, adjust date
    const overflowDays = Math.floor((h * 60 + m + hours * 60) / (24 * 60));
    let endDatePart = datePart;
    if (overflowDays > 0) {
        const [yy, mm, dd] = datePart.split('-').map(Number);
        const d = new Date(yy, mm - 1, dd);
        d.setDate(d.getDate() + overflowDays);
        const y = d.getFullYear();
        const m2 = String(d.getMonth() + 1).padStart(2, '0');
        const d2 = String(d.getDate()).padStart(2, '0');
        endDatePart = `${y}-${m2}-${d2}`;
    }
    return `${endDatePart}T${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * 依據航段推導對應的 IANA 時區
 * - 優先使用起飛地 IATA code，其次降落地，最後 fallback Asia/Taipei
 */
function getIanaTimeZone(seg) {
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

/**
 * 同步航班時間至 Google Calendar
 * 並同步飯店 Check-in / Check-out 全天事件
 * - 修正時區：不再硬寫 +08:00，改用純本地時間字串 + timeZone 欄位
 * - 孤兒事件清理：標記 extendedProperties，同步前先刪除本地已不存在的舊事件
 * @param {Array}  tickets     - 機票資料
 * @param {Array}  hotels      - 飯店住宿資料
 * @param {string} accessToken
 */
export const syncToCalendar = async (tickets, hotels = [], accessToken) => {
    try {
        const allSegments = [];
        
        tickets.forEach(t => {
            if (t.type === 'normal') {
                if(t.outboundDate) allSegments.push({ id: t.id + '-1', ticket: t, date: t.outboundDate, time: t.outboundTime || '', arrivalDate: t.outboundArrivalDate || '', arrivalTime: t.outboundArrivalTime || '', flightNo: t.outboundFlightNo || '', from: t.departRegion, to: t.returnRegion, airline: t.airline });
                if(t.inboundDate) allSegments.push({ id: t.id + '-2', ticket: t, date: t.inboundDate, time: t.inboundTime || '', arrivalDate: t.inboundArrivalDate || '', arrivalTime: t.inboundArrivalTime || '', flightNo: t.inboundFlightNo || '', from: t.returnRegion, to: t.departRegion, airline: t.airline });
            } else if (t.type === 'reverse') {
                if(t.outboundDate) allSegments.push({ id: t.id + '-1', ticket: t, date: t.outboundDate, time: t.outboundTime || '', arrivalDate: t.outboundArrivalDate || '', arrivalTime: t.outboundArrivalTime || '', flightNo: t.outboundFlightNo || '', from: t.returnRegion, to: t.departRegion, airline: t.airline });
                if(t.inboundDate) allSegments.push({ id: t.id + '-2', ticket: t, date: t.inboundDate, time: t.inboundTime || '', arrivalDate: t.inboundArrivalDate || '', arrivalTime: t.inboundArrivalTime || '', flightNo: t.inboundFlightNo || '', from: t.departRegion, to: t.returnRegion, airline: t.airline });
            } else {
                if(t.outboundDate) allSegments.push({ id: t.id + '-1', ticket: t, date: t.outboundDate, time: t.outboundTime || '', arrivalDate: t.outboundArrivalDate || '', arrivalTime: t.outboundArrivalTime || '', flightNo: t.outboundFlightNo || '', from: t.departRegion, to: t.returnRegion, airline: t.airline });
            }
        });

        const calendarId = 'primary';
        let errorLog = '';
        let addedCount = 0;
        let deletedCount = 0;
        const updatedCalendarIds = {};

        // ── 孤兒事件清理 ──────────────────────────────────────────────
        // 1. 撈出所有帶有 reverseTicketApp=true 的事件
        const orphanCheckRes = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?privateExtendedProperty=reverseTicketApp%3Dtrue&maxResults=500&singleEvents=true`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (orphanCheckRes.status === 401) return { success: false, expired: true };

        if (orphanCheckRes.ok) {
            const orphanData = await orphanCheckRes.json();
            const calendarEvents = orphanData.items || [];
            const activeSegIds = new Set(allSegments.map(s => s.id));
            const activeHotelIds = new Set(hotels.map(h => h.id));

            for (const ev of calendarEvents) {
                const segId = ev.extendedProperties?.private?.reverseTicketSegId;
                const hotelId = ev.extendedProperties?.private?.reverseTicketHotelId;

                // 檢查是否為航班孤兒
                if (segId && !activeSegIds.has(segId)) {
                    const delRes = await fetch(
                        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${ev.id}`,
                        { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
                    );
                    if (delRes.ok || delRes.status === 204 || delRes.status === 410) {
                        deletedCount++;
                    } else {
                        errorLog += `刪除航班孤兒事件失敗 (${ev.summary}): [${delRes.status}]\n`;
                    }
                }

                // 檢查是否為飯店孤兒
                if (hotelId && !activeHotelIds.has(hotelId)) {
                    const delRes = await fetch(
                        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${ev.id}`,
                        { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
                    );
                    if (delRes.ok || delRes.status === 204 || delRes.status === 410) {
                        deletedCount++;
                    } else {
                        errorLog += `刪除飯店孤兒事件失敗 (${ev.summary}): [${delRes.status}]\n`;
                    }
                }
            }
        }
        // ──────────────────────────────────────────────────────────────

        if (allSegments.length === 0) {
            return { success: true, count: 0, deletedCount, error: '您尚未新增任何機票，或者機票沒有填寫日期。' };
        }

        for (const seg of allSegments) {
            const tz = getIanaTimeZone(seg);
            const flightLabel = seg.flightNo ? `${seg.airline} (${seg.flightNo})` : seg.airline;
            const eventSummary = `[航班] ${flightLabel} ${seg.from}✈️${seg.to}`;
            
            // 🔧 時區修正：純本地時間字串 + timeZone，不手動拼 +08:00
            let startObj, endObj;
            if (seg.time) {
                const dtStr  = `${seg.date}T${seg.time}:00`;
                const eDtStr = (seg.arrivalDate && seg.arrivalTime)
                    ? `${seg.arrivalDate}T${seg.arrivalTime}:00`
                    : addHoursToLocalStr(dtStr, 2);
                startObj = { dateTime: dtStr,   timeZone: tz };
                endObj   = { dateTime: eDtStr,  timeZone: tz };
            } else {
                const dt = new Date(seg.date + 'T00:00:00');
                dt.setDate(dt.getDate() + 1);
                const y = dt.getFullYear();
                const m2 = String(dt.getMonth() + 1).padStart(2, '0');
                const d2 = String(dt.getDate()).padStart(2, '0');
                const nextDayStr = `${y}-${m2}-${d2}`;
                startObj = { date: seg.date };
                endObj   = { date: nextDayStr };
            }

            // check if eventId already stored on ticket
            let existingEventId = seg.ticket.calendarIds ? seg.ticket.calendarIds[seg.id] : null;

            if (existingEventId) {
                const verifyRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${existingEventId}`, {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });
                if (!verifyRes.ok) existingEventId = null;
            }

            // Fallback: text searching
            if (!existingEventId) {
                const minTime = encodeURIComponent(new Date(`${seg.date}T00:00:00Z`).toISOString());
                const maxTime = encodeURIComponent(new Date(`${seg.date}T23:59:59Z`).toISOString());
                
                const checkRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?timeMin=${minTime}&timeMax=${maxTime}&singleEvents=true`, {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });
                
                if (checkRes.status === 401) return { success: false, expired: true };
                if (!checkRes.ok) {
                    errorLog += `搜尋事件失敗 [${checkRes.status}]\n`;
                    continue;
                }

                const checkData = await checkRes.json();
                const matched = checkData.items && checkData.items.find(item => item.summary === eventSummary);
                if (matched) existingEventId = matched.id;
            }

            const body = {
                summary: eventSummary,
                description: `由航班反向票管理系統自動建立。\n航線：${seg.from} 到 ${seg.to}\n航空公司：${seg.airline}${seg.flightNo ? `\n航班編號：${seg.flightNo}\n追蹤航班: https://flightaware.com/live/flight/${seg.flightNo}` : ''}`,
                start: startObj,
                end: endObj,
                // 🔧 孤兒清理標記
                extendedProperties: {
                    private: {
                        reverseTicketApp: 'true',
                        reverseTicketSegId: seg.id
                    }
                }
            };

            const method = existingEventId ? 'PUT' : 'POST';
            const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events${existingEventId ? `/${existingEventId}` : ''}`;

            const insertRes = await fetch(url, {
                method,
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (insertRes.ok) {
                const resData = await insertRes.json();
                addedCount++;
                if (!updatedCalendarIds[seg.ticket.id]) updatedCalendarIds[seg.ticket.id] = {};
                updatedCalendarIds[seg.ticket.id][seg.id] = resData.id;
            } else {
                if (insertRes.status === 401) return { success: false, expired: true };
                const errText = await insertRes.text();
                errorLog += `同步事件失敗 (${seg.date} ${seg.airline}): ${errText}\n`;
            }
        }

        // ── 飯店 Check-in / Check-out 事件 ──────────────────────────────
        const updatedHotelCalendarIds = {};
        for (const hotel of hotels) {
            if (!hotel.checkIn || !hotel.checkOut) continue;

            const syncSingleHotelEvent = async (hotel, existingEventId) => {
                const body = {
                    summary: `[住宿] ${hotel.name}`,
                    description: `Check-in: ${hotel.checkIn}\nCheck-out: ${hotel.checkOut}${hotel.address ? `\n\n地址: ${hotel.address}` : ''}${hotel.confirmationNo ? `\n確認碼: ${hotel.confirmationNo}` : ''}${hotel.notes ? `\n\n備註: ${hotel.notes}` : ''}`,
                    start: { date: hotel.checkIn },
                    end: { date: hotel.checkOut }, // Google Calendar end date for full day events is exclusive, perfectly matching checkOut date
                    extendedProperties: {
                        private: { reverseTicketApp: 'true', reverseTicketHotelId: hotel.id, reverseTicketHotelType: 'stay' }
                    }
                };
                let evId = existingEventId;
                if (evId) {
                    const chk = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${evId}`, {
                        headers: { Authorization: `Bearer ${accessToken}` }
                    });
                    if (!chk.ok) evId = null;
                }
                const method = evId ? 'PUT' : 'POST';
                const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events${evId ? `/${evId}` : ''}`;
                const r = await fetch(url, {
                    method,
                    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                if (r.ok) {
                    const d = await r.json();
                    addedCount++;
                    return d.id;
                } else if (r.status === 401) {
                    return null; // caller handles expired
                }
                return null;
            };

            const stayId = await syncSingleHotelEvent(hotel, hotel.calendarCheckInId);
            
            if (stayId) {
                 updatedHotelCalendarIds[hotel.id] = { checkInId: stayId, checkOutId: null };
            }
            
            // Clean up legacy checkOut event if it exists
            if (hotel.calendarCheckOutId && hotel.calendarCheckOutId !== stayId) {
                try {
                    await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${hotel.calendarCheckOutId}`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${accessToken}` }
                    });
                } catch (e) {
                    console.error("Failed to delete legacy checkout event", e);
                }
            }
        }

        return { success: addedCount > 0 || errorLog === '', count: addedCount, deletedCount, error: errorLog, updatedCalendarIds, updatedHotelCalendarIds };
    } catch (e) {
        console.error(e);
        return { success: false, count: 0, deletedCount: 0, error: e.message };
    }
};
