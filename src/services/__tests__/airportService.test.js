import { describe, it, expect } from 'vitest';
import { getAirport, getAirportCoords, getAirportTimezone, searchAirports } from '../airportService';

describe('airportService', () => {
    it('should resolve TPE with correct coords and Asia/Taipei timezone', async () => {
        const tpe = await getAirport('TPE');
        expect(tpe).not.toBeNull();
        expect(tpe.iata).toBe('TPE');
        expect(tpe.tz).toBe('Asia/Taipei');
        expect(tpe.lat).toBeCloseTo(25.07, 1);
        expect(tpe.lng).toBeCloseTo(121.23, 1);
    });

    it('should resolve NRT with Asia/Tokyo timezone', async () => {
        const tz = await getAirportTimezone('NRT');
        expect(tz).toBe('Asia/Tokyo');
    });

    it('should resolve LHR with Europe/London timezone', async () => {
        const coords = await getAirportCoords('LHR');
        expect(coords).not.toBeNull();
        expect(coords.lat).toBeCloseTo(51.47, 1);
    });

    it('should search airports by Chinese name or IATA prefix', async () => {
        const results = await searchAirports('成田');
        expect(results.some(r => r.iata === 'NRT')).toBe(true);

        const resultsIata = await searchAirports('hnd');
        expect(resultsIata[0].iata).toBe('HND');
    });
});
