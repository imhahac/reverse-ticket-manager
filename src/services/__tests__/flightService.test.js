import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../constants/config', () => ({
    CONFIG: {
        flightProxyUrl: '',
        aviationStackKey: '',
        airLabsKey: 'airlabs-test-key',
    },
}));

vi.mock('../../constants/timing', () => ({
    TIMING: {
        FLIGHT_CACHE_TTL: 7 * 24 * 60 * 60 * 1000,
    },
}));

const { loggerMock } = vi.hoisted(() => ({
    loggerMock: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('../../utils/logger', () => ({
    logger: loggerMock,
}));

import { getOffsetDate, lookupFlight } from '../flightService';

describe('flightService', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
        global.fetch = vi.fn();
        loggerMock.info.mockClear();
        loggerMock.warn.mockClear();
        loggerMock.error.mockClear();
        loggerMock.debug.mockClear();
    });

    it('getOffsetDate shifts date by offset days', () => {
        expect(getOffsetDate('2026-04-06', 1)).toBe('2026-04-07');
        expect(getOffsetDate('2026-01-31', 1)).toBe('2026-02-01');
        expect(getOffsetDate('2026-03-01', -1)).toBe('2026-02-28');
    });

    it('returns cached flight data when cache is valid', async () => {
        localStorage.setItem('fcache_BR192', JSON.stringify({
            timestamp: Date.now(),
            data: {
                depTime: '10:00',
                arrTime: '14:00',
                dayOffset: 0,
                source: 'AirLabs (Direct Key)',
            },
        }));

        const result = await lookupFlight('br192', '2026-04-10');

        expect(result.isCache).toBe(true);
        expect(result.sourceLabel).toBe('本地快取');
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('removes broken cache and falls back to AirLabs direct fetch', async () => {
        localStorage.setItem('fcache_BR192', '{broken-json');

        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                response: [
                    {
                        dep_time: '09:30',
                        arr_time: '13:45',
                        airline_iata: 'BR',
                        flight_icao: 'EVA192',
                        dep_iata: 'TPE',
                        arr_iata: 'NRT',
                    },
                ],
            }),
        });

        const result = await lookupFlight('br192', '2026-04-10');

        expect(result.isCache).toBe(false);
        expect(result.depTime).toBe('09:30');
        expect(result.arrTime).toBe('13:45');
        expect(result.sourceLabel).toBe('AirLabs (Direct Key)');
        expect(localStorage.getItem('fcache_BR192')).toContain('"depTime":"09:30"');
        expect(loggerMock.warn).toHaveBeenCalled();
    });

    it('uses public proxy when AirLabs direct fetch fails', async () => {
        global.fetch
            .mockRejectedValueOnce(new Error('network down'))
            .mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify({
                    response: [
                        {
                            dep_time: '07:10',
                            arr_time: '10:20',
                            airline_iata: 'CX',
                            flight_icao: 'CPA450',
                            dep_iata: 'TPE',
                            arr_iata: 'HKG',
                        },
                    ],
                }),
            });

        const result = await lookupFlight('cx450', '2026-04-10');

        expect(result.isCache).toBe(false);
        expect(result.depTime).toBe('07:10');
        expect(result.arrTime).toBe('10:20');
        expect(result.sourceLabel).toBe('AirLabs (Direct Key)');
        expect(global.fetch).toHaveBeenCalledTimes(2);
        expect(loggerMock.warn).toHaveBeenCalled();
    });
});
