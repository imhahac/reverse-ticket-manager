import { toast } from 'sonner';

/** 航班號格式：2~8 位，允許字母+數字（例 BR192、CX456、NH0081） */
const FLIGHT_NO_REGEX = /^[A-Z0-9]{2,8}$/i;

/**
 * 驗證航班號格式。
 * @param {string} flightNo
 * @returns {boolean} 通過為 true；為空字串時視為「選填」回傳 true
 */
export const validateFlightNo = (flightNo) => {
    if (!flightNo) return true; // 選填
    return FLIGHT_NO_REGEX.test(flightNo.trim());
};

/**
 * 驗證數值為有效正數（> 0）。
 * @param {string|number} value
 * @returns {boolean}
 */
export const validatePositiveNumber = (value) => {
    const n = Number(value);
    return !isNaN(n) && n > 0;
};

/**
 * 驗證數值為有效非負數（>= 0）。
 * @param {string|number} value
 * @returns {boolean}
 */
export const validateNonNegativeNumber = (value) => {
    const n = Number(value);
    return !isNaN(n) && n >= 0;
};

/**
 * 組合日期與時間為本地字串
 */
export const buildLocalDateTimeStr = (date, time) => {
    if (!date) return '';
    if (!time) return `${date}T00:00:00`;
    return `${date}T${time}:00`;
};

/**
 * 將給定日期字串 (YYYY-MM-DD) 加一天
 */
export const addOneDay = (dateStr) => {
    const [y, m, d] = dateStr.split('-');
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + 1);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

/**
 * 智慧修正跨日紅眼航班
 * 若抵達時間早於出發時間，自動嘗試 +1 天。
 * @returns { arrivalDate, arrivalTime, fixed } 或 null (驗證失敗)
 */
export const autoFixArrival = (label, departDate, departTime, arrivalDate, arrivalTime) => {
    const hasArrDate = Boolean(arrivalDate);
    const hasArrTime = Boolean(arrivalTime);
    
    if (hasArrDate !== hasArrTime) {
        toast.error(`${label}：抵達日期/時間需同時填寫或同時留空`);
        return null;
    }
    
    if (!hasArrDate && !hasArrTime) {
        return { arrivalDate, arrivalTime, fixed: false };
    }

    const departStr = buildLocalDateTimeStr(departDate, departTime);
    const arriveStr = buildLocalDateTimeStr(arrivalDate, arrivalTime);
    
    if (departStr && new Date(arriveStr) < new Date(departStr)) {
        // 只有「同日填錯」才自動修正；若跨日後還是早於出發，才報錯
        const fixedDate = addOneDay(arrivalDate);
        const fixedStr = buildLocalDateTimeStr(fixedDate, arrivalTime);
        if (new Date(fixedStr) < new Date(departStr)) {
            toast.error(`${label}：抵達時間早於出發時間，且無法以 +1 天修正`);
            return null;
        }
        toast.info(`✈️ ${label}：已自動修正抵達日期 +1 天（紅眼航班跨日）`);
        return { arrivalDate: fixedDate, arrivalTime, fixed: true };
    }
    
    return { arrivalDate, arrivalTime, fixed: false };
};
