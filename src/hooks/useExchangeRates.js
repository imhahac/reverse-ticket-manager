/**
 * useExchangeRates.js ── 即時匯率 Hook
 *
 * 從 exchangerate-api 取得最新 JPY/USD 對 TWD 的匯率。
 * 若 API 失敗則靜默 fallback 到 DEFAULT_RATES。
 *
 * export：{ exchangeRates }  → { JPY: number, USD: number }
 */
import { useState, useEffect } from 'react';

const DEFAULT_RATES = { JPY: 0.21, USD: 32.5 };

export function useExchangeRates() {
    const [exchangeRates, setExchangeRates] = useState(DEFAULT_RATES);

    useEffect(() => {
        fetch('https://api.exchangerate-api.com/v4/latest/TWD')
            .then(r => r.json())
            .then(data => {
                if (!data?.rates) return;
                // data.rates.JPY = 幾 JPY 換 1 TWD → 1 JPY = 1/rates.JPY TWD
                const jpyRate = data.rates.JPY
                    ? parseFloat((1 / data.rates.JPY).toFixed(4))
                    : DEFAULT_RATES.JPY;
                const usdRate = data.rates.USD
                    ? parseFloat((1 / data.rates.USD).toFixed(2))
                    : DEFAULT_RATES.USD;
                setExchangeRates({ JPY: jpyRate, USD: usdRate });
            })
            .catch(() => {
                // 靜默 fallback，不干擾使用者
            });
    }, []);

    return { exchangeRates };
}
