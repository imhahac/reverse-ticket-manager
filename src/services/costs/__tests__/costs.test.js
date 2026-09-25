import { describe, it, expect } from 'vitest';
import { splitEqual, splitByWeights, calculateNetBalances } from '../splitCalculator';
import { calculateSettleUpTransactions } from '../settleUpService';

describe('Costs & Settle-up Algorithms', () => {
    it('should split equally using Largest Remainder without penny discrepancy', () => {
        // 100 cents among 3 people
        const shares = splitEqual(100, ['Alice', 'Bob', 'Charlie']);
        expect(shares['Alice'] + shares['Bob'] + shares['Charlie']).toBe(100);
        expect(shares['Alice']).toBe(34);
        expect(shares['Bob']).toBe(33);
        expect(shares['Charlie']).toBe(33);
    });

    it('should split by weights accurately keeping total exact', () => {
        // 100 cents with weights 2:1:1
        const shares = splitByWeights(100, { Alice: 2, Bob: 1, Charlie: 1 });
        expect(shares['Alice'] + shares['Bob'] + shares['Charlie']).toBe(100);
        expect(shares['Alice']).toBe(50);
        expect(shares['Bob']).toBe(25);
        expect(shares['Charlie']).toBe(25);
    });

    it('should calculate net balances and minimize settle-up transactions', () => {
        // Alice paid 3000 for Alice, Bob, Charlie (1000 each)
        // Bob paid 1500 for Bob, Charlie (750 each)
        const expenses = [
            {
                paidBy: 'Alice',
                baseAmount: 3000,
                shares: { Alice: 1000, Bob: 1000, Charlie: 1000 }
            },
            {
                paidBy: 'Bob',
                baseAmount: 1500,
                shares: { Bob: 750, Charlie: 750 }
            }
        ];

        const balances = calculateNetBalances(expenses);
        // Alice: paid 3000 - owed 1000 = +2000
        // Bob: paid 1500 - owed (1000+750=1750) = -250
        // Charlie: paid 0 - owed (1000+750=1750) = -1750
        expect(balances['Alice']).toBe(2000);
        expect(balances['Bob']).toBe(-250);
        expect(balances['Charlie']).toBe(-1750);

        // Sum of all balances MUST equal 0!
        const sum = Object.values(balances).reduce((a, b) => a + b, 0);
        expect(sum).toBe(0);

        const transactions = calculateSettleUpTransactions(balances);
        expect(transactions.length).toBe(2);
        // Charlie -> Alice: 1750
        // Bob -> Alice: 250
        const charlieToAlice = transactions.find(t => t.from === 'Charlie' && t.to === 'Alice');
        expect(charlieToAlice.amount).toBe(1750);
        const bobToAlice = transactions.find(t => t.from === 'Bob' && t.to === 'Alice');
        expect(bobToAlice.amount).toBe(250);
    });

    it('should balance non-zero sum float rounding discrepancies automatically with primary payer', () => {
        // Floating point rounding error scenario:
        // Alice: -33.4 -> -33
        // Bob: -33.4 -> -33
        // Charlie: +66.7 -> +67
        // Sum = -33 - 33 + 67 = +1 (unbalanced net sum!)
        const unbalancedBalances = {
            Alice: -33.4,
            Bob: -33.4,
            Charlie: 66.7
        };

        const txs = calculateSettleUpTransactions(unbalancedBalances, 'Charlie');
        expect(txs.length).toBeGreaterThan(0);
        // All payments must sum to the settled amount
        const totalPaid = txs.reduce((sum, t) => sum + t.amount, 0);
        expect(totalPaid).toBe(66); // Charlie absorbed the +1 discrepancy down to 66
    });
});
