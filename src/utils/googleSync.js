// src/utils/googleSync.js

/**
 * 上傳/覆寫資料到 Google Drive 的 reverse-tickets.json
 */
export const syncToDrive = async (tickets, tripLabels, accessToken) => {
    try {
        const query = encodeURIComponent(`name="reverse-tickets.json" and trashed=false`);
        const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        if (searchRes.status === 401) return { success: false, expired: true };
        if (!searchRes.ok) throw new Error(`搜尋 Drive 失敗: [${searchRes.status}] ${await searchRes.text()}`);

        const searchData = await searchRes.json();
        const existingFile = searchData.files && searchData.files.length > 0 ? searchData.files[0] : null;

        const fileContent = { tickets, tripLabels };

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
        // 先列出所有看起來相符的檔案，協助 Debug
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
        
        // 將所有找到的檔名收集起來傳回前端顯示
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
        
        if (Array.isArray(data)) {
            tickets = data;
        } else {
            tickets = data.tickets || [];
            tripLabels = data.tripLabels || {};
        }

        return { success: true, tickets, tripLabels, foundFilesLog: allFoundFiles };
    } catch (e) {
        console.error(e);
        return { success: false, error: e.message };
    }
};

/**
 * 同步航班時間至 Google Calendar
 */
export const syncToCalendar = async (tickets, accessToken) => {
    try {
        let addedCount = 0;
        const allSegments = [];
        
        tickets.forEach(t => {
            if (t.type === 'normal') {
                if(t.outboundDate) allSegments.push({ id: t.id + '-1', ticket: t, date: t.outboundDate, time: t.outboundTime || '', flightNo: t.outboundFlightNo || '', from: t.departRegion, to: t.returnRegion, airline: t.airline });
                if(t.inboundDate) allSegments.push({ id: t.id + '-2', ticket: t, date: t.inboundDate, time: t.inboundTime || '', flightNo: t.inboundFlightNo || '', from: t.returnRegion, to: t.departRegion, airline: t.airline });
            } else if (t.type === 'reverse') {
                if(t.outboundDate) allSegments.push({ id: t.id + '-1', ticket: t, date: t.outboundDate, time: t.outboundTime || '', flightNo: t.outboundFlightNo || '', from: t.returnRegion, to: t.departRegion, airline: t.airline });
                if(t.inboundDate) allSegments.push({ id: t.id + '-2', ticket: t, date: t.inboundDate, time: t.inboundTime || '', flightNo: t.inboundFlightNo || '', from: t.departRegion, to: t.returnRegion, airline: t.airline });
            } else {
                if(t.outboundDate) allSegments.push({ id: t.id + '-1', ticket: t, date: t.outboundDate, time: t.outboundTime || '', flightNo: t.outboundFlightNo || '', from: t.departRegion, to: t.returnRegion, airline: t.airline });
            }
        });

        const calendarId = 'primary';
        let errorLog = '';
        const updatedCalendarIds = {};
        
        for (const seg of allSegments) {
            const flightLabel = seg.flightNo ? `${seg.airline} (${seg.flightNo})` : seg.airline;
            const eventSummary = `[航班] ${flightLabel} ${seg.from}✈️${seg.to}`;
            
            // Generate full ISO string based on exact time or all-day.
            let startObj, endObj;
            if (seg.time) {
                const dtStr = `${seg.date}T${seg.time}:00+08:00`;
                const eDt = new Date(new Date(dtStr).getTime() + 2 * 3600000); // Add 2 hours for duration mapping
                const eDtStr = `${eDt.getFullYear()}-${String(eDt.getMonth()+1).padStart(2,'0')}-${String(eDt.getDate()).padStart(2,'0')}T${String(eDt.getHours()).padStart(2,'0')}:${String(eDt.getMinutes()).padStart(2,'0')}:00+08:00`;
                
                startObj = { dateTime: dtStr, timeZone: 'Asia/Taipei' };
                endObj = { dateTime: eDtStr, timeZone: 'Asia/Taipei' };
            } else {
                const dt = new Date(seg.date);
                dt.setDate(dt.getDate() + 1);
                const nextDayStr = dt.toISOString().split('T')[0];
                startObj = { date: seg.date };
                endObj = { date: nextDayStr };
            }

            // check if eventId already stored on ticket
            let existingEventId = seg.ticket.calendarIds ? seg.ticket.calendarIds[seg.id] : null;

            if (existingEventId) {
                 const verifyRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${existingEventId}`, {
                     headers: { Authorization: `Bearer ${accessToken}` }
                 });
                 if (!verifyRes.ok) existingEventId = null;
            }

            // Fallback to text searching if no direct match
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
                end: endObj
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
        
        if (allSegments.length === 0) {
            return { success: true, count: 0, error: '您尚未新增任何機票，或者機票沒有填寫日期。' };
        }

        return { success: addedCount > 0 || errorLog === '', count: addedCount, error: errorLog, updatedCalendarIds };
    } catch (e) {
        console.error(e);
        return { success: false, count: 0, error: e.message };
    }
};
