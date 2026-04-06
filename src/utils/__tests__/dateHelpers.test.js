import { describe, it, expect } from 'vitest';
import { formatDateWithDay, calculateTripDays, getSafeDateFromISO, parseLocalDate, getTimeFromISO } from '../dateHelpers';

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

describe('dateHelpers -> getSafeDateFromISO', () => {
    it('extracts date from ISO strings', () => {
        expect(getSafeDateFromISO('2026-04-06T10:20:30', 'fallback')).toBe('2026-04-06');
        expect(getSafeDateFromISO('2026-04-06 10:20:30', 'fallback')).toBe('2026-04-06');
        expect(getSafeDateFromISO('2026-04-06', 'fallback')).toBe('2026-04-06');
    });

    it('returns fallback for empty input', () => {
        expect(getSafeDateFromISO('', 'fallback')).toBe('fallback');
        expect(getSafeDateFromISO(null, 'fallback')).toBe('fallback');
    });
});

describe('dateHelpers -> parseLocalDate', () => {
    it('parses YYYY-MM-DD to local Date', () => {
        const d = parseLocalDate('2026-04-06');
        expect(d.getFullYear()).toBe(2026);
        expect(d.getMonth()).toBe(3);
        expect(d.getDate()).toBe(6);
    });

    it('returns fallback date when invalid', () => {
        const fallback = new Date(0);
        const d = parseLocalDate('invalid-date', fallback);
        expect(d.getTime()).toBe(0);
    });
});

describe('dateHelpers -> getTimeFromISO', () => {
    it('extracts HH:mm from ISO strings', () => {
        expect(getTimeFromISO('2026-04-06T10:20:30')).toBe('10:20');
        expect(getTimeFromISO('2026-04-06 23:59:59')).toBe('23:59');
    });

    it('returns empty string when input is invalid', () => {
        expect(getTimeFromISO('2026-04-06')).toBe('');
        expect(getTimeFromISO('')).toBe('');
        expect(getTimeFromISO(null)).toBe('');
    });
});
