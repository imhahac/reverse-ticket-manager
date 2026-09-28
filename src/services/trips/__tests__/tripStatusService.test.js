import { describe, it, expect } from 'vitest';
import { getTripStatus, isTripArchivedOrEnded, sortTripsByTime } from '../tripStatusService';

describe('TripStatusService - 時序排序與結束封存邏輯', () => {
    const mockToday = '2026-10-20';

    it('能依據結束日期自動辨識已結束/封存旅程', () => {
        const pastTrip = { id: 't1', title: '過去行程', startDate: '2026-05-01', endDate: '2026-05-05' };
        const ongoingTrip = { id: 't2', title: '進行中行程', startDate: '2026-10-18', endDate: '2026-10-22' };
        const futureTrip = { id: 't3', title: '未來行程', startDate: '2026-12-25', endDate: '2026-12-31' };
        const manualArchivedTrip = { id: 't4', title: '手動封存', startDate: '2026-11-01', endDate: '2026-11-05', status: 'archived' };

        expect(getTripStatus(pastTrip, mockToday)).toBe('completed');
        expect(isTripArchivedOrEnded(pastTrip, mockToday)).toBe(true);

        expect(getTripStatus(ongoingTrip, mockToday)).toBe('ongoing');
        expect(isTripArchivedOrEnded(ongoingTrip, mockToday)).toBe(false);

        expect(getTripStatus(futureTrip, mockToday)).toBe('planning');
        expect(isTripArchivedOrEnded(futureTrip, mockToday)).toBe(false);

        expect(getTripStatus(manualArchivedTrip, mockToday)).toBe('archived');
        expect(isTripArchivedOrEnded(manualArchivedTrip, mockToday)).toBe(true);
    });

    it('依時間排序：未來的旅程應按出發日由早到晚 (近到遠) 升冪排序，進行中旅程優先置頂', () => {
        const trips = [
            { id: 't_xmas', title: '2026 Tokyo 聖誕跨年', startDate: '2026-12-23', endDate: '2027-01-03' },
            { id: 't_marathon', title: '2026 Tokyo Legacy Marathon', startDate: '2026-10-16', endDate: '2026-10-22' },
            { id: 't_spring', title: '2027 春季賞櫻', startDate: '2027-03-20', endDate: '2027-03-26' }
        ];

        // 假設今天日期是 2026-10-01 (兩者皆為即將到來)
        const { activeTrips } = sortTripsByTime(trips, { todayStr: '2026-10-01' });

        // Marathon (10月) 應排在 聖誕跨年 (12月) 前面！
        expect(activeTrips[0].id).toBe('t_marathon');
        expect(activeTrips[1].id).toBe('t_xmas');
        expect(activeTrips[2].id).toBe('t_spring');
    });

    it('已結束與手動封存的旅程應被分類至 archivedTrips，並按結束日由近到遠降冪排列', () => {
        const trips = [
            { id: 't_upcoming', title: '即將出發', startDate: '2026-11-01', endDate: '2026-11-05' },
            { id: 't_past_old', title: '遠古旅行', startDate: '2025-01-01', endDate: '2025-01-05' },
            { id: 't_past_recent', title: '上個月旅行', startDate: '2026-09-01', endDate: '2026-09-05' }
        ];

        const { activeTrips, archivedTrips, sortedTrips } = sortTripsByTime(trips, { todayStr: mockToday });

        expect(activeTrips).toHaveLength(1);
        expect(activeTrips[0].id).toBe('t_upcoming');

        expect(archivedTrips).toHaveLength(2);
        // 上個月旅行 (2026-09) 比 遠古旅行 (2025-01) 更近，應排在封存清單前面
        expect(archivedTrips[0].id).toBe('t_past_recent');
        expect(archivedTrips[1].id).toBe('t_past_old');

        // sortedTrips 先是未結束，後是已結束
        expect(sortedTrips.map(t => t.id)).toEqual(['t_upcoming', 't_past_recent', 't_past_old']);
    });
});
