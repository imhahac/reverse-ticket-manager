import { describe, it, expect } from 'vitest';
import { generateTripIcs } from '../icsExportService';
import { generateTripGpx } from '../gpxExportService';

describe('Export Services - ICS & GPX', () => {
    const mockTrip = {
        id: 'trip_123',
        title: '東京賞櫻五日遊',
        startDate: '2026-04-01',
        endDate: '2026-04-05'
    };

    const mockDayPlans = [
        {
            id: 'plan_1',
            date: '2026-04-01',
            places: [
                { id: 'p1', name: '淺草寺', lat: 35.7148, lng: 139.7967, notes: '雷門拍照' },
                { id: 'p2', name: '晴空塔', lat: 35.7101, lng: 139.8107 }
            ]
        }
    ];

    const mockReservations = [
        {
            id: 'res_1',
            type: 'flight',
            airline: '長榮航空',
            flightNumber: 'BR198',
            departureAirport: 'TPE',
            arrivalAirport: 'NRT',
            departureTime: '2026-04-01T08:50:00',
            arrivalTime: '2026-04-01T13:15:00',
            confirmationCode: 'EVA123'
        },
        {
            id: 'res_2',
            type: 'hotel',
            title: '東京巨蛋飯店',
            checkInDate: '2026-04-01',
            checkOutDate: '2026-04-05',
            confirmationCode: 'HTL999'
        }
    ];

    const mockTodos = [
        { id: 't1', title: '領取 Wi-Fi 機', dueDate: '2026-03-31', priority: 'high' }
    ];

    it('should generate valid RFC 5545 iCalendar content', () => {
        const ics = generateTripIcs(mockTrip, mockDayPlans, mockReservations, mockTodos);

        expect(ics).toContain('BEGIN:VCALENDAR');
        expect(ics).toContain('VERSION:2.0');
        expect(ics).toContain('X-WR-CALNAME:東京賞櫻五日遊');

        // Check flight event
        expect(ics).toContain('SUMMARY:✈️ 長榮航空 BR198 (TPE ➔ NRT)');
        expect(ics).toContain('EVA123');

        // Check hotel event
        expect(ics).toContain('SUMMARY:🏨 住宿: 東京巨蛋飯店');

        // Check place visit
        expect(ics).toContain('SUMMARY:📍 淺草寺');
        expect(ics).toContain('雷門拍照');

        // Check todo deadline
        expect(ics).toContain('SUMMARY:⏰ 待辦: 領取 Wi-Fi 機');

        expect(ics).toContain('END:VCALENDAR');
    });

    it('should generate valid GPX 1.1 with waypoints and track', () => {
        const gpx = generateTripGpx(mockTrip, mockDayPlans);

        expect(gpx).toContain('<?xml version="1.0" encoding="UTF-8"?>');
        expect(gpx).toContain('<gpx version="1.1"');
        expect(gpx).toContain('<name>東京賞櫻五日遊</name>');

        // Check waypoints
        expect(gpx).toContain('<wpt lat="35.7148" lon="139.7967">');
        expect(gpx).toContain('<name>淺草寺</name>');
        expect(gpx).toContain('<wpt lat="35.7101" lon="139.8107">');
        expect(gpx).toContain('<name>晴空塔</name>');

        // Check track
        expect(gpx).toContain('<trk>');
        expect(gpx).toContain('<trkseg>');
        expect(gpx).toContain('<trkpt lat="35.7148" lon="139.7967">');
        expect(gpx).toContain('</trkseg>');
    });
});
