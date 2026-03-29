import { describe, it, expect } from 'vitest';
import { formatDateWithDay, calculateTripDays } from '../dateHelpers';

describe('dateHelpers -> formatDateWithDay', () => {
    it('returns empty string if dateStr is falsy', () => {
        expect(formatDateWithDay(null)).toBe('');
        expect(formatDateWithDay(undefined)).toBe('');
        expect(formatDateWithDay('')).toBe('');
    });

    it('returns original string if date is invalid', () => {
        expect(formatDateWithDay('invalid-date')).toBe('invalid-date');
    });

    it('formats valid date strings correctly with day of week', () => {
        // 2025-05-01 is a Thursday
        expect(formatDateWithDay('2025-05-01')).toBe('2025-05-01 (四)');
        // 2024-02-29 is a Thursday (Leap year)
        expect(formatDateWithDay('2024-02-29')).toBe('2024-02-29 (四)');
        // 2024-03-03 is a Sunday
        expect(formatDateWithDay('2024-03-03')).toBe('2024-03-03 (日)');
    });
});

describe('dateHelpers -> calculateTripDays', () => {
    it('returns null if either date is missing', () => {
        expect(calculateTripDays('2024-01-01', null)).toBeNull();
        expect(calculateTripDays(null, '2024-01-01')).toBeNull();
        expect(calculateTripDays('', '')).toBeNull();
    });

    it('returns null for invalid dates', () => {
        expect(calculateTripDays('abc', '2024-01-01')).toBeNull();
        expect(calculateTripDays('2024-01-01', 'xyz')).toBeNull();
    });

    it('returns null if inbound is before outbound', () => {
        expect(calculateTripDays('2024-01-05', '2024-01-01')).toBeNull();
    });

    it('calculates correct inclusive days', () => {
        expect(calculateTripDays('2024-05-01', '2024-05-03')).toBe(3);
        expect(calculateTripDays('2024-05-01', '2024-05-01')).toBe(1); // Same day is 1 day
        expect(calculateTripDays('2024-02-28', '2024-03-01')).toBe(3); // Leap year handling (2024 has 2/29)
        expect(calculateTripDays('2023-02-28', '2023-03-01')).toBe(2); // Non-leap year 
    });
});
