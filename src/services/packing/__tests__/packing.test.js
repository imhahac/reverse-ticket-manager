import { describe, it, expect } from 'vitest';
import { calculatePackingStats, PACKING_TEMPLATES } from '../packingTemplates';

describe('Packing & Baggage Weight Calculation', () => {
    it('should calculate packed progress and weight roll-up in kilograms', () => {
        const items = [
            { name: 'Passport', isPacked: true, weightGrams: 100 },
            { name: 'Clothes', isPacked: true, weightGrams: 900 },
            { name: 'Shoes', isPacked: false, weightGrams: 1200 }
        ];

        const stats = calculatePackingStats(items);

        expect(stats.totalCount).toBe(3);
        expect(stats.packedCount).toBe(2);
        expect(stats.progressPercent).toBe(67); // 2/3 = 66.6% -> 67%
        expect(stats.totalWeightKg).toBe(2.2); // (100 + 900 + 1200) / 1000 = 2.2 kg
        expect(stats.packedWeightKg).toBe(1.0); // (100 + 900) / 1000 = 1.0 kg
    });

    it('should provide valid preset templates', () => {
        expect(PACKING_TEMPLATES.length).toBeGreaterThanOrEqual(3);
        const tropical = PACKING_TEMPLATES.find(t => t.id === 'tropical');
        expect(tropical).toBeDefined();
        expect(tropical.items.length).toBeGreaterThan(0);
    });
});
