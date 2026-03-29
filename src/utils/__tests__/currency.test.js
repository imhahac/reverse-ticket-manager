import { describe, it, expect, vi } from 'vitest';
import { convertToTWD } from '../currency';

// Mock CONFIG because currency.js depends on it
vi.mock('../../constants/config', () => ({
    CONFIG: {
        exchangeRates: {
            JPY: 0.22,
            USD: 32.0
        }
    }
}));

describe('currencyUtils -> convertToTWD', () => {
    it('returns 0 for invalid input', () => {
        expect(convertToTWD(null, 'TWD')).toBe(0);
        expect(convertToTWD(undefined, 'TWD')).toBe(0);
        expect(convertToTWD('abc', 'TWD')).toBe(0);
        expect(convertToTWD('', 'TWD')).toBe(0);
    });

    it('returns Math.round(val) for TWD without rate conversion', () => {
        expect(convertToTWD(100.4, 'TWD')).toBe(100);
        expect(convertToTWD(100.5, 'TWD')).toBe(101);
        expect(convertToTWD('500', 'TWD')).toBe(500);
    });

    it('uses provided custom rates over default CONFIG rates', () => {
        const customRates = { JPY: 0.25, USD: 30 };
        expect(convertToTWD(1000, 'JPY', customRates)).toBe(250);   // 1000 * 0.25
        expect(convertToTWD(10, 'USD', customRates)).toBe(300);     // 10 * 30
    });

    it('falls back to CONFIG rates if custom rates object is passed but lacks the currency', () => {
        const customRates = { EUR: 35 }; // Missing JPY
        // default mock CONFIG JPY is 0.22
        expect(convertToTWD(1000, 'JPY', customRates)).toBe(220);
    });

    it('falls back to a rate of 1 if currency is unknown and not in CONFIG nor custom rates', () => {
        // e.g. 'GBP' is not in our mock CONFIG
        expect(convertToTWD(100, 'GBP', {})).toBe(100);
    });

    it('handles string numbers correctly in conversion', () => {
        const customRates = { JPY: 0.2 };
        expect(convertToTWD('1000.5', 'JPY', customRates)).toBe(200); // 1000.5 * 0.2 = 200.1 -> round 200
    });
});
