// src/utils/googleSync.js

/**
 * 上傳/覆寫資料到 Google Drive 的 reverse-tickets.json
 */
export const syncToDrive = async (tickets, tripLabels, accessToken) => {
    try {
        // 1. 尋找是否存在該檔案
        const query = encodeURIComponent(`name="reverse-tickets.json" and trashed=false`);
        const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        if (!searchRes.ok) {
            throw new Error(`搜尋 Drive 失敗: [${searchRes.status}] ${await searchRes.text()}`);
        }

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

        if (!res.ok) {
            throw new Error(`上傳檔案失敗: [${res.status}] ${await res.text()}`);
        }
        
        const resData = await res.json();
        return { success: true, fileId: resData.id };
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
        let errorLog = '';
        
        for (const seg of allSegments) {
            const eventSummary = `[航班] ${seg.airline} ${seg.from}✈️${seg.to}`;
            
            // 嘗試搜尋這天是否已經有這個事件了 (粗略比對 summary)
            const minTime = encodeURIComponent(new Date(`${seg.date}T00:00:00Z`).toISOString());
            const maxTime = encodeURIComponent(new Date(`${seg.date}T23:59:59Z`).toISOString());
            
            const checkRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?timeMin=${minTime}&timeMax=${maxTime}&singleEvents=true`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            
            if (!checkRes.ok) {
                errorLog += `搜尋事件失敗 [${checkRes.status}] ${await checkRes.text()}\n`;
                continue;
            }

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
                const errText = await insertRes.text();
                console.error('Insert Event Failed:', errText);
                errorLog += `新增事件失敗 (${seg.date} ${seg.airline}): ${errText}\n`;
            }
        }
        
        if (allSegments.length === 0) {
            return { success: true, count: 0, error: '您尚未新增任何機票，或者機票沒有填寫日期。' };
        }

        return { success: addedCount > 0 || errorLog === '', count: addedCount, error: errorLog };
    } catch (e) {
        console.error(e);
        return { success: false, count: 0, error: e.message };
    }
};
