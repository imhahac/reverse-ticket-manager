import { describe, it, expect } from 'vitest';
import { parseGpx, parseKml, parseMapLinks, parseMapLinksSync } from '../geoImportService';

describe('GeoImportService - GPX, KML & Map Links', () => {
    it('should parse GPX XML with waypoints correctly', () => {
        const sampleGpx = `<?xml version="1.0" encoding="UTF-8"?>
        <gpx version="1.1" creator="Test">
            <wpt lat="25.033964" lon="121.564472">
                <name>Taipei 101</name>
                <desc>Landmark tower</desc>
                <ele>508.0</ele>
            </wpt>
            <wpt lat="25.037486" lon="121.563666">
                <name>Taipei City Hall</name>
            </wpt>
        </gpx>`;

        const places = parseGpx(sampleGpx);
        expect(places.length).toBe(2);
        expect(places[0].name).toBe('Taipei 101');
        expect(places[0].lat).toBeCloseTo(25.033964);
        expect(places[0].lng).toBeCloseTo(121.564472);
        expect(places[0].ele).toBe(508.0);
        expect(places[1].name).toBe('Taipei City Hall');
    });

    it('should parse KML with placemarks correctly', () => {
        const sampleKml = `<?xml version="1.0" encoding="UTF-8"?>
        <kml xmlns="http://www.opengis.net/kml/2.2">
            <Document>
                <Placemark>
                    <name>Tokyo Tower</name>
                    <description>Iconic red tower</description>
                    <Point>
                        <coordinates>139.7454,35.6586,333</coordinates>
                    </Point>
                </Placemark>
            </Document>
        </kml>`;

        const places = parseKml(sampleKml);
        expect(places.length).toBe(1);
        expect(places[0].name).toBe('Tokyo Tower');
        expect(places[0].lat).toBeCloseTo(35.6586);
        expect(places[0].lng).toBeCloseTo(139.7454);
        expect(places[0].desc).toBe('Iconic red tower');
    });

    it('should extract Google Maps and raw coordinates from text (Sync & Async)', async () => {
        const text = `
Check out this place:
https://www.google.com/maps/place/Taipei+101/@25.033964,121.564472,17z/data=xxx
And this view:
https://www.google.com/maps?q=35.6586,139.7454
Also plain coords:
25.1023, 121.5485
        `;

        // 1. 同步解析測試
        const syncPlaces = parseMapLinksSync(text);
        expect(syncPlaces.length).toBe(3);
        expect(syncPlaces[0].name).toBe('Taipei 101');
        expect(syncPlaces[0].lat).toBeCloseTo(25.033964);
        expect(syncPlaces[0].lng).toBeCloseTo(121.564472);
        expect(syncPlaces[1].lat).toBeCloseTo(35.6586);
        expect(syncPlaces[1].lng).toBeCloseTo(139.7454);
        expect(syncPlaces[2].lat).toBeCloseTo(25.1023);
        expect(syncPlaces[2].lng).toBeCloseTo(121.5485);

        // 2. 非同步解析測試
        const places = await parseMapLinks(text);
        expect(places.length).toBe(3);
    });

    it('應能解析寬鬆座標、含地名座標與 Apple/Naver/Protobuf 多元格式', async () => {
        const mixedText = `
東京鐵塔 35.6586, 139.7454
(25.0339, 121.5644)
https://maps.apple.com/?q=Shibuya+Sky&ll=35.6591,139.7006
https://www.google.com/maps/place/Meiji+Shrine/data=!3d35.6764!4d139.6993
https://map.naver.com/v5/?c=15,0,0,0,dh&lat=37.5665&lng=126.9780
        `;

        const places = await parseMapLinks(mixedText);
        expect(places.length).toBe(5);

        // 驗證地名與座標抽取
        expect(places[0].name).toBe('東京鐵塔');
        expect(places[0].lat).toBeCloseTo(35.6586);
        expect(places[0].lng).toBeCloseTo(139.7454);

        expect(places[1].lat).toBeCloseTo(25.0339);
        expect(places[1].lng).toBeCloseTo(121.5644);

        expect(places[2].name).toBe('Shibuya Sky');
        expect(places[2].lat).toBeCloseTo(35.6591);

        expect(places[3].name).toBe('Meiji Shrine');
        expect(places[3].lat).toBeCloseTo(35.6764);

        expect(places[4].source).toBe('naver_maps');
        expect(places[4].lat).toBeCloseTo(37.5665);
    });

    it('當輸入含有地名但缺乏經緯度（如短網址分享詞或純地名），應自動調用 Nominatim 取得真實座標', async () => {
        const shareText = `
在 Google 地圖上查看「東京晴空塔」：https://maps.app.goo.gl/dummyShortUrl123
淺草寺
        `;

        const places = await parseMapLinks(shareText);
        expect(places.length).toBeGreaterThanOrEqual(1);

        const skytree = places.find(p => p.name.includes('東京晴空塔') || p.name.includes('晴空塔'));
        expect(skytree).toBeDefined();
        expect(skytree.lat).toBeGreaterThan(35);
        expect(skytree.lng).toBeGreaterThan(139);
    });

    it('應能將純 Google Maps 短網址自動還原展開並解析出地標名稱與經緯度', async () => {
        const pureShortUrl = 'https://maps.app.goo.gl/DCZgEbksd1NB8tUN7';
        const places = await parseMapLinks(pureShortUrl);

        expect(places.length).toBeGreaterThanOrEqual(1);
        const teamLab = places[0];
        expect(teamLab.name).toContain('teamLab');
        expect(teamLab.lat).toBeCloseTo(35.6491, 2);
        expect(teamLab.lng).toBeCloseTo(139.7897, 2);
        expect(teamLab.source).toBe('google_maps');
    });
});
