import { describe, it, expect } from 'vitest';
import { calculateDayDifference, shiftDateString } from '../tripShiftService';

describe('TripShiftService - Date Shifting Logic', () => {
    it('should calculate positive and negative day difference accurately', () => {
        expect(calculateDayDifference('2026-04-01', '2026-04-10')).toBe(9);
        expect(calculateDayDifference('2026-04-10', '2026-04-01')).toBe(-9);
        expect(calculateDayDifference('2026-04-01', '2026-04-01')).toBe(0);
        // Leap year and month crossing
        expect(calculateDayDifference('2024-02-28', '2024-03-01')).toBe(2);
    });

    it('should shift YYYY-MM-DD date strings by N days', () => {
        expect(shiftDateString('2026-04-01', 5)).toBe('2026-04-06');
        expect(shiftDateString('2026-04-01', -3)).toBe('2026-03-29');
        expect(shiftDateString('2026-12-30', 3)).toBe('2027-01-02');
    });

    it('should shift ISO datetime strings while keeping exact hours and minutes', () => {
        const originalIso = '2026-04-01T08:50:00';
        const shiftedIso = shiftDateString(originalIso, 7);
        expect(shiftedIso).toBe('2026-04-08T08:50:00');

        const negativeShift = shiftDateString(originalIso, -2);
        expect(negativeShift).toBe('2026-03-30T08:50:00');
    });
});
