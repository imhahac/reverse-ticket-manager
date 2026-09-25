/**
 * icsExportService.js
 * RFC 5545 標準 iCalendar (.ics) 行事曆格式產生與匯出服務
 * 支援將旅程、航班、火車、住宿、景點與待辦事項匯出為行事曆事件，
 * 可一鍵匯入 Apple Calendar、Google Calendar、Outlook 或訂閱。
 */

function formatIcsDateTime(dateStr, timeStr = null) {
    if (!dateStr) return null;
    const cleanDate = dateStr.replace(/[-:]/g, '');

    if (!timeStr) {
        // 全天事件 VALUE=DATE
        return `;VALUE=DATE:${cleanDate}`;
    }

    const cleanTime = timeStr.replace(/[-:]/g, '').padEnd(6, '0').slice(0, 6);
    return `:${cleanDate}T${cleanTime}`;
}

function escapeIcsText(text = '') {
    if (!text) return '';
    return text
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\r?\n/g, '\\n');
}

/**
 * 產出符合 RFC 5545 標準的 iCalendar 字串
 * @param {Object} trip
 * @param {Array<Object>} dayPlans
 * @param {Array<Object>} reservations
 * @param {Array<Object>} todos
 * @returns {string}
 */
export function generateTripIcs(trip, dayPlans = [], reservations = [], todos = []) {
    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//TREK//Travel Planner//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        `X-WR-CALNAME:${escapeIcsText(trip?.title || '旅遊行程')}`,
        'X-WR-TIMEZONE:Asia/Taipei'
    ];

    const nowStamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';

    // 1. 匯出預訂憑證 (航班、火車、住宿、票券)
    reservations.forEach((res, index) => {
        const uid = `res_${res.id || index}_${Date.now()}@trek.app`;

        if (res.type === 'flight') {
            // 航班航段
            const depCode = res.departureAirport || 'DEP';
            const arrCode = res.arrivalAirport || 'ARR';
            const flightNo = `${res.airline || ''} ${res.flightNumber || ''}`.trim() || '航班';
            const depDate = res.departureTime ? res.departureTime.slice(0, 10) : res.date;
            const depTime = res.departureTime ? res.departureTime.slice(11, 16) : null;
            const arrDate = res.arrivalTime ? res.arrivalTime.slice(0, 10) : depDate;
            const arrTime = res.arrivalTime ? res.arrivalTime.slice(11, 16) : null;

            lines.push('BEGIN:VEVENT');
            lines.push(`UID:${uid}`);
            lines.push(`DTSTAMP:${nowStamp}`);
            lines.push(`SUMMARY:✈️ ${escapeIcsText(flightNo)} (${depCode} ➔ ${arrCode})`);
            if (depDate) lines.push(`DTSTART${formatIcsDateTime(depDate, depTime)}`);
            if (arrDate) lines.push(`DTEND${formatIcsDateTime(arrDate, arrTime || depTime)}`);
            lines.push(`LOCATION:${escapeIcsText(depCode)}`);
            lines.push(`DESCRIPTION:${escapeIcsText(`訂位代碼 (PNR): ${res.confirmationCode || '無'}\\n座位: ${res.seatNumber || '未指定'}\\n航廈: ${res.departureTerminal || '-'}`)}`);
            lines.push('STATUS:CONFIRMED');
            lines.push('END:VEVENT');
        } else if (res.type === 'hotel') {
            // 飯店住宿 (跨日全天事件)
            const checkIn = res.checkInDate || res.date;
            const checkOut = res.checkOutDate || res.endDate || checkIn;

            lines.push('BEGIN:VEVENT');
            lines.push(`UID:${uid}`);
            lines.push(`DTSTAMP:${nowStamp}`);
            lines.push(`SUMMARY:🏨 住宿: ${escapeIcsText(res.title || res.hotelName || '飯店')}`);
            if (checkIn) lines.push(`DTSTART${formatIcsDateTime(checkIn)}`);
            if (checkOut) lines.push(`DTEND${formatIcsDateTime(checkOut)}`);
            lines.push(`LOCATION:${escapeIcsText(res.address || '')}`);
            lines.push(`DESCRIPTION:${escapeIcsText(`確認號: ${res.confirmationCode || '無'}\\n房型: ${res.roomType || '-'}`)}`);
            lines.push('STATUS:CONFIRMED');
            lines.push('END:VEVENT');
        } else {
            // 其他票券或活動
            const actDate = res.date || trip?.startDate;
            lines.push('BEGIN:VEVENT');
            lines.push(`UID:${uid}`);
            lines.push(`DTSTAMP:${nowStamp}`);
            lines.push(`SUMMARY:🎟️ ${escapeIcsText(res.title || '活動預訂')}`);
            if (actDate) lines.push(`DTSTART${formatIcsDateTime(actDate)}`);
            if (actDate) lines.push(`DTEND${formatIcsDateTime(actDate)}`);
            lines.push(`DESCRIPTION:${escapeIcsText(`確認號: ${res.confirmationCode || '無'}`)}`);
            lines.push('END:VEVENT');
        }
    });

    // 2. 匯出每日規劃景點
    dayPlans.forEach((plan, pIdx) => {
        const places = plan.places || [];
        places.forEach((place, plIdx) => {
            const uid = `place_${plan.id || pIdx}_${place.id || plIdx}_${Date.now()}@trek.app`;
            const planDate = plan.date;

            lines.push('BEGIN:VEVENT');
            lines.push(`UID:${uid}`);
            lines.push(`DTSTAMP:${nowStamp}`);
            lines.push(`SUMMARY:📍 ${escapeIcsText(place.name || '景點參訪')}`);
            if (planDate) {
                // 依順序安排時間，預設從早上 10:00 起每站間隔 1.5 小時
                const startHour = 10 + Math.floor(plIdx * 1.5);
                const startMinute = (plIdx % 2 === 0) ? '00' : '30';
                const startTime = `${String(startHour).padStart(2, '0')}:${startMinute}`;
                const endTime = `${String(startHour + 1).padStart(2, '0')}:${startMinute}`;

                lines.push(`DTSTART${formatIcsDateTime(planDate, startTime)}`);
                lines.push(`DTEND${formatIcsDateTime(planDate, endTime)}`);
            }
            if (place.address) lines.push(`LOCATION:${escapeIcsText(place.address)}`);
            if (place.notes) lines.push(`DESCRIPTION:${escapeIcsText(place.notes)}`);
            lines.push('END:VEVENT');
        });
    });

    // 3. 匯出待辦截止日
    todos.forEach((todo, idx) => {
        if (!todo.dueDate) return;
        const uid = `todo_${todo.id || idx}@trek.app`;
        lines.push('BEGIN:VEVENT');
        lines.push(`UID:${uid}`);
        lines.push(`DTSTAMP:${nowStamp}`);
        lines.push(`SUMMARY:⏰ 待辦: ${escapeIcsText(todo.title)}`);
        lines.push(`DTSTART${formatIcsDateTime(todo.dueDate)}`);
        lines.push(`DTEND${formatIcsDateTime(todo.dueDate)}`);
        lines.push(`DESCRIPTION:${escapeIcsText(`優先級: ${todo.priority} | 負責人: ${todo.assignee || '未指派'}`)}`);
        lines.push('END:VEVENT');
    });

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
}

/**
 * 觸發瀏覽器下載 .ics 檔案
 * @param {string} filename
 * @param {string} icsContent
 */
export function downloadIcsFile(filename = 'itinerary.ics', icsContent = '') {
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
