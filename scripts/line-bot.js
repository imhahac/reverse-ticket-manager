import { google } from 'googleapis';
import axios from 'axios';

// 由於 ESM 環境無法直接使用 require，若需要可以 import date-fns，
// 但為求無額外依賴複雜度，這裡直接使用原生 Date 來加減天數。
const getLocalDateString = (dateObj) => {
    // 依據 UTC+8 時間為主
    const offset = 8;
    const utc = dateObj.getTime() + (dateObj.getTimezoneOffset() * 60000);
    const tzDate = new Date(utc + (3600000 * offset));
    
    const yyyy = tzDate.getFullYear();
    const mm = String(tzDate.getMonth() + 1).padStart(2, '0');
    const dd = String(tzDate.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const run = async () => {
    console.log("Starting LINE Bot Cron Job...");
    try {
        const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS;
        if (!credentialsJson) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_CREDENTIALS");
        
        let credentials;
        try {
            credentials = JSON.parse(credentialsJson);
        } catch (e) {
            throw new Error("Invalid format for GOOGLE_SERVICE_ACCOUNT_CREDENTIALS (must be JSON)");
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
        if (Array.isArray(data)) {
            tickets = data;
        } else {
            tickets = data.tickets || [];
        }

        if (tickets.length === 0) {
            console.log('No tickets found in the configuration.');
            return;
        }

        // Process segments
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

        const today = new Date();
        const todayStr = getLocalDateString(today);
        
        const tmr = new Date(today);
        tmr.setDate(tmr.getDate() + 1);
        const tmrStr = getLocalDateString(tmr);
        
        const in3Days = new Date(today);
        in3Days.setDate(in3Days.getDate() + 3);
        const in3DaysStr = getLocalDateString(in3Days);

        let messages = [];

        allSegments.forEach(seg => {
            if (seg.date === in3DaysStr) {
                messages.push(`【行前準備提醒】\n三天後即將出發！\n✈️ 航班: ${seg.airline}\n📍 路線: ${seg.from} ➔ ${seg.to}\n📅 日期: ${seg.date}\n記得再次確認行李與相關證件喔！`);
            } else if (seg.date === tmrStr) {
                messages.push(`【即將啟程】\n明天就要飛囉！\n✈️ 航班: ${seg.airline}\n📍 路線: ${seg.from} ➔ ${seg.to}\n📅 日期: ${seg.date}\n祝您旅途愉快、平安順心！`);
            } else if (seg.date === todayStr) {
                messages.push(`【今日出發】\n就是今天！\n✈️ 航班: ${seg.airline}\n📍 路線: ${seg.from} ➔ ${seg.to}\n📅 日期: ${seg.date}\n準備好報到手續了嗎？出發吧！`);
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
