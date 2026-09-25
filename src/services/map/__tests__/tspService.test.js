import { describe, it, expect } from 'vitest';
import { optimizeRouteWith2Opt, calculateTotalRouteDistance } from '../tspService';

describe('tspService - 2-opt TSP Route Optimizer', () => {
    it('should return the same array if less than 3 places', () => {
        const places = [
            { id: '1', lat: 35.6895, lng: 139.6917 } // 東京
        ];
        const res = optimizeRouteWith2Opt(places);
        expect(res.optimizedPlaces.length).toBe(1);
        expect(res.improvedKm).toBe(0);
    });

    it('should uncross criss-crossing routes and reduce total distance', () => {
        // Square vertices: A(0,0), B(0,2), C(2,2), D(2,0)
        // Criss-crossing order: A -> C -> B -> D (hourglass)
        // Optimal order: A -> B -> C -> D
        const places = [
            { id: 'A', name: 'Start', lat: 35.0, lng: 139.0 },
            { id: 'C', name: 'Diagonal Top', lat: 35.2, lng: 139.2 },
            { id: 'B', name: 'Bottom Right', lat: 35.0, lng: 139.2 },
            { id: 'D', name: 'Top Left', lat: 35.2, lng: 139.0 }
        ];

        const originalDist = calculateTotalRouteDistance(places);
        const result = optimizeRouteWith2Opt(places);

        expect(result.optimizedDistance).toBeLessThan(originalDist);
        expect(result.improvedKm).toBeGreaterThan(0);
    });

    it('should keep hotel anchor start, end and locked stops fixed', () => {
        const places = [
            { id: 'Hotel_Start', isAnchorStart: true, lat: 35.0, lng: 139.0 },
            { id: 'P1', lat: 35.3, lng: 139.3 },
            { id: 'Locked_Spot', isLocked: true, lat: 35.1, lng: 139.1 }, // 鎖定在 index 2
            { id: 'P2', lat: 35.05, lng: 139.05 },
            { id: 'Hotel_End', isAnchorEnd: true, lat: 35.4, lng: 139.4 }
        ];

        const result = optimizeRouteWith2Opt(places);

        expect(result.optimizedPlaces[0].id).toBe('Hotel_Start');
        expect(result.optimizedPlaces[result.optimizedPlaces.length - 1].id).toBe('Hotel_End');
        expect(result.optimizedPlaces[2].id).toBe('Locked_Spot');
    });
});
