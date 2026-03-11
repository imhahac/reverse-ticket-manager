// src/utils/googleSync.js

/**
 * 上傳/覆寫資料到 Google Drive 的 reverse-tickets.json
 */
export const syncToDrive = async (tickets, tripLabels, accessToken) => {
    try {
        // 1. 尋找是否存在該檔案
        const searchRes = await fetch('https://www.googleapis.com/drive/v3/files?q=name="reverse-tickets.json" and trashed=false&spaces=appDataFolder,drive', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const searchData = await searchRes.json();
        const existingFile = searchData.files && searchData.files.length > 0 ? searchData.files[0] : null;

        const fileMetadata = { name: 'reverse-tickets.json', mimeType: 'application/json' };
        
        // 為了相容，我們將 tickets 與 tripLabels 包裝起來
        const fileContent = { tickets, tripLabels };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
        form.append('file', new Blob([JSON.stringify(fileContent)], { type: 'application/json' }));

        let uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
        let method = 'POST';
        if (existingFile) {
            uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`;
            method = 'PATCH';
        }

        const res = await fetch(uploadUrl, {
            method,
            headers: { Authorization: `Bearer ${accessToken}` },
            body: form
        });

        if (!res.ok) throw new Error('上傳 Google Drive 失敗');
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
};

/**
 * 從 Google Drive 下載 reverse-tickets.json
 */
export const loadFromDrive = async (accessToken) => {
    try {
        const searchRes = await fetch('https://www.googleapis.com/drive/v3/files?q=name="reverse-tickets.json" and trashed=false&spaces=appDataFolder,drive', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const searchData = await searchRes.json();
        const existingFile = searchData.files && searchData.files.length > 0 ? searchData.files[0] : null;

        if (!existingFile) return null;

        const downloadRes = await fetch(`https://www.googleapis.com/drive/v3/files/${existingFile.id}?alt=media`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        if (!downloadRes.ok) throw new Error('下載資料失敗');
        
        const data = await downloadRes.json();
        
        let tickets = [];
        let tripLabels = {};
        
        if (Array.isArray(data)) {
            tickets = data;
        } else {
            tickets = data.tickets || [];
            tripLabels = data.tripLabels || {};
        }

        return { tickets, tripLabels };
    } catch (e) {
        console.error(e);
        return null;
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
                if(t.outboundDate) allSegments.push({ date: t.outboundDate, from: t.departRegion, to: t.returnRegion, airline: t.airline });
                if(t.inboundDate) allSegments.push({ date: t.inboundDate, from: t.returnRegion, to: t.departRegion, airline: t.airline });
            } else if (t.type === 'reverse') {
                if(t.outboundDate) allSegments.push({ date: t.outboundDate, from: t.returnRegion, to: t.departRegion, airline: t.airline });
                if(t.inboundDate) allSegments.push({ date: t.inboundDate, from: t.departRegion, to: t.returnRegion, airline: t.airline });
            } else {
                if(t.outboundDate) allSegments.push({ date: t.outboundDate, from: t.departRegion, to: t.returnRegion, airline: t.airline });
            }
        });

        const calendarId = 'primary';
        
        for (const seg of allSegments) {
            const eventSummary = `[航班] ${seg.airline} ${seg.from}✈️${seg.to}`;
            
            // 嘗試搜尋這天是否已經有這個事件了 (粗略比對 summary)
            const minTime = new Date(`${seg.date}T00:00:00Z`).toISOString();
            const maxTime = new Date(`${seg.date}T23:59:59Z`).toISOString();
            
            const checkRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?timeMin=${minTime}&timeMax=${maxTime}&singleEvents=true`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            const checkData = await checkRes.json();
            
            const exists = checkData.items && checkData.items.some(item => item.summary === eventSummary);
            if (exists) {
                console.log(`事件已存在，跳過: ${eventSummary}`);
                continue;
            }

            // 新增事件
            // Google Calendar 全天事件的 end date 必須是「開始日期的隔天」
            const dt = new Date(seg.date);
            dt.setDate(dt.getDate() + 1);
            const nextDayStr = dt.toISOString().split('T')[0];

            const body = {
                summary: eventSummary,
                description: `由航班反向票管理系統自動建立。\n航線：${seg.from} 到 ${seg.to}\n航班號碼：${seg.airline}`,
                start: { date: seg.date },
                end: { date: nextDayStr }
            };

            const insertRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (insertRes.ok) {
                addedCount++;
            } else {
                console.error('Insert Event Failed:', await insertRes.text());
            }
        }
        
        return { success: true, count: addedCount };
    } catch (e) {
        console.error(e);
        return { success: false, count: 0, error: e.message };
    }
};
