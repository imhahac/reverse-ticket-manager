/**
 * currencyService.js
 * Frankfurter API 即時匯率查詢與凍結機制 (免 Key)
 * 支援任意幣別換算為 Trip 基準結算幣別 (預設 TWD)
 */

import { logger } from '../../utils/logger';

export const SUPPORTED_CURRENCIES = [
    { code: 'TWD', name: '新台幣', symbol: 'NT$' },
    { code: 'JPY', name: '日圓', symbol: '¥' },
    { code: 'USD', name: '美元', symbol: '$' },
    { code: 'EUR', name: '歐元', symbol: '€' },
    { code: 'KRW', name: '韓元', symbol: '₩' },
    { code: 'THB', name: '泰銖', symbol: '฿' },
    { code: 'HKD', name: '港幣', symbol: 'HK$' },
    { code: 'SGD', name: '新加坡幣', symbol: 'S$' },
    { code: 'GBP', name: '英鎊', symbol: '£' },
    { code: 'CNY', name: '人民幣', symbol: '¥' },
    { code: 'AUD', name: '澳幣', symbol: 'A$' },
    { code: 'CAD', name: '加幣', symbol: 'C$' }
];

// 離線備援基準匯率 (相對 TWD)
export const FALLBACK_RATES_TO_TWD = {
    TWD: 1,
    JPY: 0.21,
    USD: 32.2,
    EUR: 34.8,
    KRW: 0.024,
    THB: 0.92,
    HKD: 4.12,
    SGD: 24.1,
    GBP: 41.5,
    CNY: 4.45,
    AUD: 21.3,
    CAD: 23.5
};

const rateCache = {}; // 快取: `${from}_${to}` -> { rate, timestamp }
const CACHE_DURATION_MS = 1000 * 60 * 30; // 30 分鐘快取

/**
 * 取得最新匯率 (優先走 Frankfurter API，失敗則回退離線基準匯率)
 * @param {string} fromCurrency - 例如 'JPY'
 * @param {string} toCurrency - 例如 'TWD'
 * @returns {Promise<number>} 1 單位 fromCurrency 等於多少 toCurrency
 */
export async function getExchangeRate(fromCurrency = 'TWD', toCurrency = 'TWD') {
    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();

    if (from === to) return 1;

    const cacheKey = `${from}_${to}`;
    const cached = rateCache[cacheKey];
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
        return cached.rate;
    }

    try {
        const url = `https://api.frankfurter.app/latest?from=${from}&to=${to}`;
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            const rate = data.rates?.[to];
            if (typeof rate === 'number') {
                rateCache[cacheKey] = { rate, timestamp: Date.now() };
                return rate;
            }
        }
    } catch (err) {
        logger.warn(`Frankfurter rate fetch failed for ${from} -> ${to}, using fallback:`, err);
    }

    // 離線備援計算: rate = (FALLBACK[from] / FALLBACK[to])
    const fromVal = FALLBACK_RATES_TO_TWD[from] || 1;
    const toVal = FALLBACK_RATES_TO_TWD[to] || 1;
    const fallbackRate = Math.round((fromVal / toVal) * 10000) / 10000;
    return fallbackRate;
}

/**
 * 在建立或確認支出時凍結匯率與換算金額
 */
export async function freezeExchangeRate(amount, fromCurrency, baseCurrency = 'TWD') {
    const numAmount = Number(amount) || 0;
    const rate = await getExchangeRate(fromCurrency, baseCurrency);
    const baseAmount = Math.round(numAmount * rate * 100) / 100;

    return {
        originalAmount: numAmount,
        currency: fromCurrency,
        rateToTripBase: rate,
        baseCurrency,
        baseAmount,
        frozenAt: Date.now()
    };
}
