/**
 * ✈️ 航班工具函式
 */

/**
 * IATA 航空公司代碼轉 ICAO 代碼 (FlightAware 偏好使用 ICAO)
 */
export const IATA_TO_ICAO = {
    'CI': 'CAL', // China Airlines
    'BR': 'EVA', // EVA Air
    'CX': 'CPA', // Cathay Pacific
    'JL': 'JAL', // Japan Airlines
    'NH': 'ANA', // All Nippon Airways
    'JX': 'SJW', // Starlux Airlines
    'AE': 'MDA', // Mandarin Airlines
    'GE': 'TNA', // TransAsia (Historical)
    'IT': 'TTW', // Tigerair Taiwan
    'MM': 'APJ', // Peach Aviation
    'GK': 'JJP', // Jetstar Japan
    'VN': 'HVN', // Vietnam Airlines
    'TG': 'THA', // Thai Airways
    'SQ': 'SIA', // Singapore Airlines
    'OZ': 'AAR', // Asiana Airlines
    'KE': 'KAL', // Korean Air
};

/**
 * 產生 FlightAware 追蹤連結
 * 會自動將 IATA 代碼轉換為 ICAO 代碼以確保連結準確
 * @param {string} flightNo 航班編號 (e.g., CI222, CAL222, JX800)
 * @returns {string} FlightAware 預覽連結
 */
export function getFlightAwareUrl(flightNo) {
    if (!flightNo) return '';
    
    // 1. 移除所有空格並轉大寫 (處理如 "CI 222" 或 "CAL 222" 的輸入)
    const cleanNo = flightNo.replace(/\s+/g, '').toUpperCase();
    
    // 🎨 判定邏輯:
    // 1. 如果開頭已經是 3 個大寫字母，視為已經是 ICAO 代碼 (如 CAL222, EVA191)。
    // 2. 如果開頭是 2 個字元，則查表轉換為 ICAO (如 CI222 -> CAL222)。
    
    if (/^[A-Z]{3}\d+$/.test(cleanNo)) {
        return `https://www.flightaware.com/live/flight/${cleanNo}`;
    }
    
    const iataMatch = cleanNo.match(/^([A-Z0-9]{2})(\d+)$/);
    if (iataMatch) {
        const iataCode = iataMatch[1];
        const num = iataMatch[2];
        const icaoCode = IATA_TO_ICAO[iataCode] || iataCode;
        return `https://www.flightaware.com/live/flight/${icaoCode}${num}`;
    }
    
    // Fallback
    return `https://www.flightaware.com/live/flight/${cleanNo}`;
}
