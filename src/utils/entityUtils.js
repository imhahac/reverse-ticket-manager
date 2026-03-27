/**
 * entityUtils.js
 * 獨立處理實體（飯店、活動等）的純邏輯與資料格式化，遠離 React State 與 UI 副作用
 */

import { geocodeAddress } from './geoUtils';

/**
 * 處理實體資料的地理編碼 (Geocoding) 擴充
 * @param {Object} item - 原始物件（如 hotel, activity）
 * @param {string} titleField - 提供名稱的欄位名稱 (例如 'name', 'title')
 * @param {string} locationField - 提供地址/地點的欄位名稱 (例如 'address', 'location')
 * @returns {Promise<{ enrichedItem: Object, geoSuccess: boolean, query: string }>}
 */
export const processGeocodedEntity = async (item, titleField, locationField) => {
    const query = `${item[titleField] || ''} ${item[locationField] || ''}`.trim();
    let enrichedItem = { ...item };
    let geoSuccess = false;

    if (query) {
        try {
            const geoResult = await geocodeAddress(query);
            if (geoResult) {
                enrichedItem = { ...enrichedItem, lat: geoResult.lat, lng: geoResult.lng };
                geoSuccess = true;
            }
        } catch (e) {
            console.error('Failed to geocode address:', e);
        }
    }

    return { enrichedItem, geoSuccess, query };
};
