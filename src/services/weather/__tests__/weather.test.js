import { describe, it, expect } from 'vitest';
import { getWeatherInfo, WMO_WEATHER_MAP } from '../weatherService';

describe('weatherService - WMO Weather Code Mapping', () => {
    it('should map WMO code 0 to 晴朗 with sun icon', () => {
        const info = getWeatherInfo(0);
        expect(info.label).toBe('晴朗');
        expect(info.icon).toBe('☀️');
    });

    it('should map rain and snow codes accurately', () => {
        expect(getWeatherInfo(61).label).toBe('小陣雨');
        expect(getWeatherInfo(73).label).toBe('中雪');
        expect(getWeatherInfo(95).label).toBe('雷雨');
    });

    it('should return fallback for unknown weather codes', () => {
        const fallback = getWeatherInfo(999);
        expect(fallback.label).toBe('陰晴不一');
        expect(fallback.icon).toBe('🌤️');
    });

    it('should have complete mappings for standard codes in WMO_WEATHER_MAP', () => {
        expect(Object.keys(WMO_WEATHER_MAP).length).toBeGreaterThan(15);
    });
});
