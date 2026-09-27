import { describe, it, expect } from 'vitest';
import { searchPlaces } from '../../services/places/placeSearchService';
import { getDayWeather } from '../../services/weather/weatherService';
import { getOSRMRoute } from '../../services/map/routeService';

describe('全系統真實外部服務聯網與架構驗收', () => {
    it('1. Nominatim 地點搜尋能取得真實地理經緯度', async () => {
        const places = await searchPlaces('明治神宮');
        expect(places.length).toBeGreaterThan(0);
        const meiji = places[0];
        console.log('【Nominatim 回傳】:', {
            name: meiji.name,
            lat: meiji.lat,
            lng: meiji.lng,
            displayName: meiji.displayName
        });
        expect(meiji.lat).toBeCloseTo(35.67, 1);
        expect(meiji.lng).toBeCloseTo(139.69, 1);
    }, 15000);

    it('2. Open-Meteo 能對真實坐標提供歷史氣候與即時數值預報', async () => {
        // 遠期 (>16天)
        const farWeather = await getDayWeather(35.6764, 139.6993, '2026-10-16');
        console.log('【Open-Meteo 遠期歷史氣候】:', farWeather);
        expect(farWeather).not.toBeNull();
        expect(farWeather.isHistoricalEstimate).toBe(true);
        expect(farWeather.desc).toContain('(歷年氣候預估)');
        expect(typeof farWeather.tempMax).toBe('number');

        // 近期 (0~15天)
        const nearDate = new Date();
        nearDate.setDate(nearDate.getDate() + 3);
        const nearDateStr = nearDate.toISOString().slice(0, 10);
        const nearWeather = await getDayWeather(35.6764, 139.6993, nearDateStr);
        console.log('【Open-Meteo 近期即時數值】:', nearWeather);
        expect(nearWeather).not.toBeNull();
        expect(nearWeather.isHistoricalEstimate).toBe(false);
        expect(nearWeather.desc).not.toContain('(歷年氣候預估)');
        expect(typeof nearWeather.rainProb).toBe('number');
    }, 15000);

    it('3. OSRM 能計算真實街道拓撲，回傳彎曲折線而非直線', async () => {
        const osrmResult = await getOSRMRoute([
            { lat: 35.6764, lng: 139.6993 }, // 明治神宮
            { lat: 35.6716, lng: 139.7047 }  // 竹下通
        ]);
        console.log('【OSRM 道路路網計算】:', {
            distanceKm: osrmResult?.distanceKm,
            durationMinutes: osrmResult?.durationMinutes,
            geometryType: osrmResult?.geometry?.type,
            coordinateCount: osrmResult?.geometry?.coordinates?.length
        });
        expect(osrmResult).not.toBeNull();
        expect(osrmResult.distanceKm).toBeGreaterThan(1);
        expect(osrmResult.geometry.type).toBe('LineString');
        // 真實道路不是直線兩點，包含許多轉彎坐標
        expect(osrmResult.geometry.coordinates.length).toBeGreaterThan(10);
    }, 15000);
});
