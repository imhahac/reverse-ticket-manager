/**
 * currency.js ── 幣別換算工具
 */
import { CONFIG } from '../constants/config';

export const DEFAULT_RATES = {
    JPY: CONFIG.exchangeRates.JPY,
    USD: CONFIG.exchangeRates.USD,
};

/**
 * 將原始金額換算為 TWD
 * @param {number|string} price - 原始金額
 * @param {string} currency - 'TWD', 'JPY', 'USD' 等
 * @param {Object} rates - 匯率物件
 * @returns {number} 換算後的 TWD (整數)
 */
export const convertToTWD = (price, currency, rates = DEFAULT_RATES) => {
    const val = parseFloat(price);
    if (!val || isNaN(val)) return 0;
    if (currency === 'TWD') return Math.round(val);
    
    // 如果傳入 custom rates 且沒有該幣別，則回到 CONFIG 預設值
    const userRate = rates?.[currency];
    const defaultRate = CONFIG.exchangeRates[currency];
    
    const rate = typeof userRate === 'number' ? userRate : (typeof defaultRate === 'number' ? defaultRate : 1);
               
    return Math.round(val * rate);
};
