import { google } from 'googleapis';
import axios from 'axios';
import { format, addDays } from 'date-fns';

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
            const timeStr = seg.time ? ` ${seg.time}` : '';
            const flightLabel = seg.flightNo ? `${seg.airline} (${seg.flightNo})` : seg.airline;
            
            if (seg.date === in3DaysStr) {
                messages.push(`【行前準備提醒】\n三天後即將出發！\n✈️ 航班: ${flightLabel}\n📍 路線: ${seg.from} ➔ ${seg.to}\n📅 日期: ${seg.date}${timeStr}\n記得再次確認行李與相關證件喔！\n🔗 查看訂單: https://imhahac.github.io/reverse-ticket-manager/`);
            } else if (seg.date === tmrStr) {
                messages.push(`【即將啟程】\n明天就要飛囉！\n✈️ 航班: ${flightLabel}\n📍 路線: ${seg.from} ➔ ${seg.to}\n📅 日期: ${seg.date}${timeStr}\n祝您旅途愉快、平安順心！\n🔗 查看訂單: https://imhahac.github.io/reverse-ticket-manager/`);
            } else if (seg.date === todayStr) {
                messages.push(`【今日出發】\n就是今天！\n✈️ 航班: ${flightLabel}\n📍 路線: ${seg.from} ➔ ${seg.to}\n📅 日期: ${seg.date}${timeStr}\n準備好報到手續了嗎？出發吧！\n🔗 查看訂單: https://imhahac.github.io/reverse-ticket-manager/`);
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
