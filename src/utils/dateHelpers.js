/**
 * dateHelpers.js
 * 日期格式化與計算工具函式。
 * 純函式，無副作用，可直接於任何元件或 Hook 中 import 使用。
 */

/**
 * 將 ISO 日期字串格式化為含星期的顯示字串。
 * @param {string} dateStr - "YYYY-MM-DD" 格式的日期字串
 * @returns {string} 例如 "2025-05-01 (四)"；若 dateStr 無效則原樣回傳
 */
export const formatDateWithDay = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return dateStr;
    const [y, m, d] = parts;
    const date = new Date(y, m - 1, d);
    if (isNaN(date.getTime())) return dateStr;
    const days = ['(日)', '(一)', '(二)', '(三)', '(四)', '(五)', '(六)'];
    return `${dateStr} ${days[date.getDay()]}`;
};

/**
 * 計算兩個日期之間的「含頭含尾」天數。
 * 例如：5/1 ~ 5/3 = 3 天。
 * @param {string} outboundDate - 出發日期 "YYYY-MM-DD"
 * @param {string} inboundDate  - 返回日期 "YYYY-MM-DD"
 * @returns {number|null} 天數；若任一日期無效或 inbound < outbound 則回傳 null
 */
export const calculateTripDays = (outboundDate, inboundDate) => {
    if (!outboundDate || !inboundDate) return null;
    const start = parseLocalDate(outboundDate);
    const end = parseLocalDate(inboundDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
    
    // Set to local midnights to avoid DST differences
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    
    const diffTime = end.getTime() - start.getTime();
    if (diffTime < 0) return null;
    
    return Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
};

/**
 * 安全擷取 ISO datetime 的日期部分。
 * @param {string} isoStr - 例如 "2026-04-06T10:20:00"
 * @param {string} fallback - 解析失敗時回傳值
 * @returns {string}
 */
export const getSafeDateFromISO = (isoStr, fallback = '') => {
    if (!isoStr) return fallback;
    if (isoStr.includes('T')) return isoStr.split('T')[0];
    if (isoStr.includes(' ')) return isoStr.split(' ')[0];
    return isoStr;
};

/**
 * 以本地時區建立日期物件，避免 YYYY-MM-DD 被當作 UTC 解析。
 * @param {string} dateStr - "YYYY-MM-DD"
 * @param {Date} fallbackDate - 無效輸入時回傳的 Date
 * @returns {Date}
 */
export const parseLocalDate = (dateStr, fallbackDate = new Date()) => {
    if (!dateStr) return fallbackDate;
    const [y, m, d] = dateStr.split('-').map(Number);
    if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return fallbackDate;
    return new Date(y, m - 1, d);
};

/**
 * 擷取 ISO datetime 的 HH:mm。
 * @param {string} isoStr - 例如 "2026-04-06T10:20:00"
 * @returns {string}
 */
export const getTimeFromISO = (isoStr) => {
    if (!isoStr) return '';
    const timePart = isoStr.includes('T')
        ? isoStr.split('T')[1]
        : (isoStr.includes(' ') ? isoStr.split(' ')[1] : '');
    return timePart ? timePart.substring(0, 5) : '';
};
