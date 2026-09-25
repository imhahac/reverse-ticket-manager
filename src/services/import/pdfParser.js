/**
 * pdfParser.js
 * 純前端 PDF 電子機票與飯店憑證結構化智能解析器
 * 採用 pdfjs-dist 動態非同步載入，不增加首頁 Initial Bundle
 */

import { logger } from '../../utils/logger';

export async function parsePDFDocument(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfjs = await import('pdfjs-dist');

        // 設定 workerSrc
        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
            pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
        }

        const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
        const pdfDoc = await loadingTask.promise;

        let fullText = '';
        for (let i = 1; i <= Math.min(pdfDoc.numPages, 5); i++) {
            const page = await pdfDoc.getPage(i);
            const textContent = await page.getTextContent();
            const pageStr = textContent.items.map(item => item.str).join(' ');
            fullText += ' ' + pageStr;
        }

        logger.info(`Extracted ${fullText.length} characters from PDF`);
        return extractReservationFromText(fullText, file.name);
    } catch (err) {
        logger.error('PDF parsing failed:', err);
        return { success: false, error: err.message };
    }
}

/**
 * 依據文字內容特徵結構化提取航班或飯店資訊
 */
export function extractReservationFromText(text, fallbackFileName = '') {
    if (!text) return { success: false, error: 'Empty text' };

    // 1. 偵測是否為飯店 (Booking.com / Agoda / Airbnb / Hotel)
    const isHotel = /hotel|booking\.com|agoda|airbnb|check-in|入住|退房|旅館|飯店/i.test(text);
    if (isHotel) {
        const pnrMatch = text.match(/(?:Confirmation number|預訂編號|確認碼|PIN code)[:\s]*([A-Z0-9\.\-]+)/i);
        const checkInMatch = text.match(/(?:Check-in|入住日期|Arrival)[:\s]*([0-9]{4}[\/\-][0-9]{2}[\/\-][0-9]{2})/i);
        const checkOutMatch = text.match(/(?:Check-out|退房日期|Departure)[:\s]*([0-9]{4}[\/\-][0-9]{2}[\/\-][0-9]{2})/i);
        const hotelNameMatch = text.match(/(?:Hotel|Property|飯店名稱)[:\s]*([^\n\r,\.]+)/i);

        return {
            success: true,
            type: 'accommodation',
            title: hotelNameMatch ? hotelNameMatch[1].trim() : (fallbackFileName.replace('.pdf', '') || '飯店預訂'),
            confirmationCode: pnrMatch ? pnrMatch[1].trim() : '',
            accommodationDetails: {
                name: hotelNameMatch ? hotelNameMatch[1].trim() : fallbackFileName.replace('.pdf', ''),
                checkInDate: checkInMatch ? checkInMatch[1].replace(/\//g, '-') : '',
                checkOutDate: checkOutMatch ? checkOutMatch[1].replace(/\//g, '-') : ''
            },
            rawTextSnippet: text.slice(0, 300)
        };
    }

    // 2. 偵測機票 (Flight / Airline / E-ticket)
    const flightMatch = text.match(/\b([A-Z0-9]{2})\s*([0-9]{3,4})\b/);
    const pnrMatch = text.match(/(?:Booking Reference|Confirmation Code|Record Locator|PNR|訂位代碼|訂位代號)[\(\):\s]*([A-Z0-9]{6})/i);
    const dateMatch = text.match(/\b(202[4-9][\/\-](?:0[1-9]|1[0-2])[\/\-](?:0[1-9]|[12][0-9]|3[01]))\b/);

    // 尋找 3 碼 IATA 代碼 (例如 TPE, NRT, KIX)
    const iataMatches = text.match(/\b(TPE|TSA|KHH|RMQ|NRT|HND|KIX|ITM|FUK|OKA|CTS|BKK|DMK|SIN|HKG|MFM|ICN|GMP|PUS|CJU|LAX|SFO|JFK|LHR|CDG|FRA|AMS|SYD|MEL)\b/g);
    const fromIata = iataMatches?.[0] || 'TPE';
    const toIata = iataMatches?.[1] || (iataMatches?.[0] !== 'NRT' ? 'NRT' : 'KIX');

    const flightNo = flightMatch ? `${flightMatch[1]}${flightMatch[2]}` : '';
    const confirmation = pnrMatch ? pnrMatch[1].toUpperCase() : '';

    return {
        success: true,
        type: 'flight',
        title: flightNo ? `${flightNo} (${fromIata} → ${toIata})` : (fallbackFileName.replace('.pdf', '') || '機票預訂'),
        confirmationCode: confirmation,
        flightDetails: {
            airline: flightMatch?.[1] || '',
            flightNumber: flightNo,
            from: fromIata,
            to: toIata,
            departureTime: dateMatch ? dateMatch[1].replace(/\//g, '-') : ''
        },
        rawTextSnippet: text.slice(0, 300)
    };
}
