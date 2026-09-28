import { describe, it, expect } from 'vitest';
import { assembleTripDays, normalizeReservations } from '../tripExportAssembler';
import { generateTripIcs } from '../../export/icsExportService';
import { generateTripGpx } from '../../export/gpxExportService';

describe('Trip Export Assembler & Full Export Flow', () => {
    const mockTrip = {
        id: 'trip_legacy_marathon',
        title: '2026 Tokyo Legacy Marathon',
        startDate: '2026-10-16',
        endDate: '2026-10-22',
        baseCurrency: 'TWD'
    };

    const mockPlaces = [
        { id: 'p1', dayIndex: 0, orderIndex: 1, name: '淺草寺', address: '東京都台東區淺草2-3-1', lat: 35.7148, lng: 139.7967, notes: '雷門大燈籠' },
        { id: 'p2', dayIndex: 0, orderIndex: 0, name: '東京成田機場', address: '千葉縣成田市', lat: 35.7720, lng: 140.3929 },
        { id: 'p3', dayIndex: 2, orderIndex: 0, name: '國立競技場 (馬拉松起跑點)', address: '東京都新宿區霞之丘町10-1', lat: 35.6779, lng: 139.7145, notes: '領取選手物資' },
        { id: 'p4', dayIndex: 6, orderIndex: 0, name: '羽田機場國際線航廈', address: '東京都大田區羽田空港', lat: 35.5494, lng: 139.7798 }
    ];

    const mockUnifiedReservations = [
        {
            id: 'res_flight_1',
            type: 'flight',
            confirmationCode: 'BR198_PNR',
            seatNumber: '21A',
            flightDetails: {
                airline: '長榮航空',
                flightNumber: 'BR198',
                from: 'TPE',
                to: 'NRT',
                departureTime: '2026-10-16 08:50',
                arrivalTime: '2026-10-16 13:15',
                departureTerminal: 'T2'
            }
        },
        {
            id: 'res_hotel_1',
            type: 'accommodation',
            confirmationCode: 'HTL_TOKYO_123',
            accommodationDetails: {
                name: '新宿格拉斯麗飯店 (哥吉拉飯店)',
                checkInDate: '2026-10-16',
                checkOutDate: '2026-10-22',
                address: '東京都新宿區歌舞伎町1-19-1'
            }
        }
    ];

    it('應根據 startDate 與 endDate 正確計算 7 天日程，並將景點依照 dayIndex 與 orderIndex 正確排序歸位', () => {
        const assembledDays = assembleTripDays({
            trip: mockTrip,
            dayPlans: [],
            places: mockPlaces
        });

        // 2026-10-16 到 2026-10-22 總共 7 天
        expect(assembledDays).toHaveLength(7);
        expect(assembledDays[0].date).toBe('2026-10-16');
        expect(assembledDays[6].date).toBe('2026-10-22');

        // Day 1 (dayIndex 0) 應有 2 個景點，且依 orderIndex 排序成：東京成田機場 -> 淺草寺
        expect(assembledDays[0].places).toHaveLength(2);
        expect(assembledDays[0].places[0].name).toBe('東京成田機場');
        expect(assembledDays[0].places[1].name).toBe('淺草寺');

        // Day 2 (dayIndex 1) 無景點，places 應為 []
        expect(assembledDays[1].places).toHaveLength(0);

        // Day 3 (dayIndex 2) 應有 1 個景點：國立競技場
        expect(assembledDays[2].places).toHaveLength(1);
        expect(assembledDays[2].places[0].name).toBe('國立競技場 (馬拉松起跑點)');

        // Day 7 (dayIndex 6) 應有 1 個景點：羽田機場國際線航廈
        expect(assembledDays[6].places).toHaveLength(1);
        expect(assembledDays[6].places[0].name).toBe('羽田機場國際線航廈');
    });

    it('若景點有超出原訂天數的 dayIndex，應自動動態擴充日程天數', () => {
        const shortTrip = {
            id: 'short',
            startDate: '2026-05-01',
            endDate: '2026-05-02'
        };
        const extraPlaces = [
            { id: 'p_extra', dayIndex: 4, name: '遠征景點' }
        ];

        const assembledDays = assembleTripDays({
            trip: shortTrip,
            dayPlans: [],
            places: extraPlaces
        });

        expect(assembledDays.length).toBeGreaterThanOrEqual(5);
        expect(assembledDays[4].places[0].name).toBe('遠征景點');
    });

    it('應正確正規化 unifiedReservations 中的航班與飯店資料', () => {
        const { flights, hotels } = normalizeReservations(mockUnifiedReservations);

        expect(flights).toHaveLength(1);
        expect(flights[0].airline).toBe('長榮航空');
        expect(flights[0].flightNumber).toBe('BR198');
        expect(flights[0].departureAirport).toBe('TPE');
        expect(flights[0].arrivalAirport).toBe('NRT');
        expect(flights[0].confirmationCode).toBe('BR198_PNR');
        expect(flights[0].seatNumber).toBe('21A');
        expect(flights[0].departureTerminal).toBe('T2');

        expect(hotels).toHaveLength(1);
        expect(hotels[0].title).toBe('新宿格拉斯麗飯店 (哥吉拉飯店)');
        expect(hotels[0].checkInDate).toBe('2026-10-16');
        expect(hotels[0].checkOutDate).toBe('2026-10-22');
        expect(hotels[0].address).toBe('東京都新宿區歌舞伎町1-19-1');
        expect(hotels[0].confirmationCode).toBe('HTL_TOKYO_123');
    });

    it('產出的組裝日程與統一預訂能直接匯出為完整有效的 ICS 與 GPX', () => {
        const assembledDays = assembleTripDays({
            trip: mockTrip,
            places: mockPlaces
        });

        // 1. ICS 測試
        const ics = generateTripIcs(mockTrip, assembledDays, mockUnifiedReservations, []);
        expect(ics).toContain('BEGIN:VCALENDAR');
        expect(ics).toContain('2026 Tokyo Legacy Marathon');
        expect(ics).toContain('SUMMARY:✈️ 長榮航空 BR198 (TPE ➔ NRT)');
        expect(ics).toContain('SUMMARY:🏨 住宿: 新宿格拉斯麗飯店 (哥吉拉飯店)');
        expect(ics).toContain('SUMMARY:📍 國立競技場 (馬拉松起跑點)');
        expect(ics).toContain('SUMMARY:📍 淺草寺');
        expect(ics).toContain('END:VCALENDAR');

        // 2. GPX 測試
        const gpx = generateTripGpx(mockTrip, assembledDays);
        expect(gpx).toContain('<?xml version="1.0" encoding="UTF-8"?>');
        expect(gpx).toContain('<name>2026 Tokyo Legacy Marathon</name>');
        expect(gpx).toContain('<name>淺草寺</name>');
        expect(gpx).toContain('<name>東京成田機場</name>');
    });
});
