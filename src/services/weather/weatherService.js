/**
 * weatherService.js
 * Open-Meteo 16 天即時天氣預報與歷史同日氣候回溯服務 (免 Key)
 */

import { logger } from '../../utils/logger';

export const WMO_WEATHER_MAP = {
    0: { label: '晴朗', icon: '☀️' },
    1: { label: '主要晴朗', icon: '🌤️' },
    2: { label: '多雲', icon: '⛅' },
    3: { label: '陰天', icon: '☁️' },
    45: { label: '有霧', icon: '🌫️' },
    48: { label: '霧淞', icon: '🌫️' },
    51: { label: '細雨', icon: '🌦️' },
    53: { label: '小雨', icon: '🌧️' },
    55: { label: '濃密小雨', icon: '🌧️' },
    61: { label: '小陣雨', icon: '🌧️' },
    63: { label: '中雨', icon: '🌧️' },
    65: { label: '豪大雨', icon: '⛈️' },
    71: { label: '小雪', icon: '🌨️' },
    73: { label: '中雪', icon: '❄️' },
    75: { label: '大雪', icon: '❄️' },
    80: { label: '陣雨', icon: '🌦️' },
    81: { label: '強烈陣雨', icon: '🌧️' },
    82: { label: '劇烈陣雨', icon: '⛈️' },
    95: { label: '雷雨', icon: '⛈️' },
    96: { label: '雷雨伴隨冰雹', icon: '⛈️' }
};

export function getWeatherInfo(code) {
    return WMO_WEATHER_MAP[code] || { label: '陰晴不一', icon: '🌤️' };
}

/**
 * 查詢特定經緯度與日期區間的天氣
 * @param {number} lat
 * @param {number} lng
 * @param {string} targetDate - YYYY-MM-DD
 * @returns {Promise<{tempMax: number, tempMin: number, rainProb: number, desc: string, icon: string, isHistoricalEstimate: boolean}|null>}
 */
export async function getDayWeather(lat, lng, targetDate) {
    if (!lat || !lng || !targetDate) return null;

    const today = new Date().toISOString().slice(0, 10);
    const target = new Date(targetDate);
    const now = new Date(today);
    const diffDays = Math.round((target - now) / 86400000);

    // 1. 若在未來 16 天之內且不是過去日期，走 Open-Meteo 16-day forecast
    if (diffDays >= 0 && diffDays <= 15) {
        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`;
            const res = await fetch(url);
            if (!res.ok) return null;
            const data = await res.json();

            const dates = data.daily?.time || [];
            const idx = dates.indexOf(targetDate);
            if (idx !== -1) {
                const code = data.daily.weather_code[idx];
                const info = getWeatherInfo(code);
                return {
                    tempMax: Math.round(data.daily.temperature_2m_max[idx]),
                    tempMin: Math.round(data.daily.temperature_2m_min[idx]),
                    rainProb: data.daily.precipitation_probability_max?.[idx] || 0,
                    desc: info.label,
                    icon: info.icon,
                    isHistoricalEstimate: false
                };
            }
        } catch (err) {
            logger.warn('Failed to fetch Open-Meteo forecast:', err);
        }
    }

    // 2. 超出 16 天範圍或過去日期，調用前一年同日期的歷史氣候紀錄 (Historical Archive)
    try {
        const pastYear = target.getFullYear() - 1;
        const pastDateStr = `${pastYear}-${targetDate.slice(5)}`;
        const archiveUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&start_date=${pastDateStr}&end_date=${pastDateStr}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;

        const res = await fetch(archiveUrl);
        if (!res.ok) return null;
        const data = await res.json();

        if (data.daily?.temperature_2m_max?.length > 0) {
            const code = data.daily.weather_code[0];
            const info = getWeatherInfo(code);
            return {
                tempMax: Math.round(data.daily.temperature_2m_max[0]),
                tempMin: Math.round(data.daily.temperature_2m_min[0]),
                rainProb: 20, // 歷史預設
                desc: `${info.label} (歷年氣候預估)`,
                icon: info.icon,
                isHistoricalEstimate: true
            };
        }
    } catch (err) {
        logger.warn('Failed to fetch historical weather archive:', err);
    }

    return null;
}
