/**
 * airportUtils.js ── 台灣機場 IATA 代碼清單（單一來源）
 *
 * 若日後新增機場（例如 TTT 台東），在此處修改即可，
 * 不必同時改 useTrips / useItinerary / tripOverrides 三處。
 */

export const TW_CODES = ['TPE', 'TSA', 'KHH', 'RMQ'];

/**
 * 判斷機場字串是否屬於台灣機場。
 * @param {string} regionStr - 例如 "TPE (台北桃園)" 或純 IATA "TPE"
 * @returns {boolean}
 */
export const isTaiwan = (regionStr) =>
    TW_CODES.some(code => (regionStr || '').includes(code));
