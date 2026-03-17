/**
 * currency.js ── 幣別換算工具
 */

export const DEFAULT_RATES = {
    JPY: 0.21,
    USD: 32.5,
};

/**
 * 將原始金額換算為 TWD
 * @param {number|string} price - 原始金額
 * @param {string} currency - 'TWD', 'JPY', 'USD'
 * @param {Object} rates - { JPY, USD } 匯率
 * @returns {number} 換算後的 TWD (整數)
 */
export const convertToTWD = (price, currency, rates = DEFAULT_RATES) => {
    const val = parseFloat(price);
    if (!val || isNaN(val)) return 0;
    if (currency === 'TWD') return Math.round(val);
    
    const rate = (currency === 'JPY') ? (rates?.JPY ?? DEFAULT_RATES.JPY)
               : (currency === 'USD') ? (rates?.USD ?? DEFAULT_RATES.USD)
               : 1;
               
    return Math.round(val * rate);
};
