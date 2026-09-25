import { describe, it, expect } from 'vitest';
import { generateExpensesCsvContent } from '../csvExportService';

describe('csvExportService - UTF-8 BOM CSV Generation', () => {
    it('should prepend UTF-8 BOM and format expenses correctly with quote escaping', () => {
        const mockExpenses = [
            {
                id: 'exp1',
                title: '晚餐 "米其林" 懷石料理',
                category: '餐飲美食',
                amount: 30000,
                currency: 'JPY',
                rateToTripBase: 0.21,
                baseAmount: 6300,
                paidBy: 'Alice',
                splitType: 'equal',
                settled: false,
                createdAt: 1743465600000 // 2025-04-01
            }
        ];

        const mockSettlements = [
            { from: 'Bob', to: 'Alice', amount: 3150 }
        ];

        const csv = generateExpensesCsvContent('東京賞櫻 5 日遊', mockExpenses, mockSettlements);

        // 1. Must start with UTF-8 BOM (\uFEFF)
        expect(csv.startsWith('\uFEFF')).toBe(true);

        // 2. Must contain trip title and metadata
        expect(csv).toContain('旅程名稱,東京賞櫻 5 日遊');

        // 3. Must escape double quotes inside titles correctly
        expect(csv).toContain('"晚餐 ""米其林"" 懷石料理"');

        // 4. Must format amounts and status
        expect(csv).toContain('30000,JPY,0.21,6300,Alice,等額平分,未結清');

        // 5. Must include settlement suggestions
        expect(csv).toContain('=== 智慧清帳還款建議 ===');
        expect(csv).toContain('Bob,Alice,3150');
    });
});
