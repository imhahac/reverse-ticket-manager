/**
 * settleUpService.js
 * 智慧清帳與債務最小化演算法 (Settle-Up Debt Simplification)
 * 將群組複雜的多人交叉欠款，化簡為筆數最少、金額最簡潔的轉帳清單。
 * 內建尾數平衡吸收機制，杜絕浮點數四捨五入導致的未清帳死結！
 */

/**
 * 計算清帳撮合轉帳清單
 * @param {Record<string, number>} balances - 各成員淨餘額 (正為應收，負為欠款)
 * @param {string|null} primaryPayer - 主要付款人 (若有尾數差額由其吸收)
 * @returns {Array<{ from: string, to: string, amount: number }>}
 */
export function calculateSettleUpTransactions(balances, primaryPayer = null) {
    if (!balances || typeof balances !== 'object') return [];

    const entries = Object.entries(balances)
        .map(([user, bal]) => ({ user, balance: Math.round(bal) }))
        .filter(item => item.balance !== 0);

    if (entries.length === 0) return [];

    // 1. 檢驗四捨五入後的整數分淨總額
    const netSum = entries.reduce((sum, item) => sum + item.balance, 0);

    // 2. 若存在尾數差額 (例如浮點數換算導致 +1 或 -1 分)，由 primaryPayer 或最大金額者自動平衡吸收
    if (netSum !== 0) {
        let absorber = entries.find(item => item.user === primaryPayer);
        if (!absorber) {
            // 尋找絕對值最大之參與者吸收差額
            absorber = entries.reduce((max, curr) => 
                Math.abs(curr.balance) > Math.abs(max.balance) ? curr : max, entries[0]
            );
        }
        absorber.balance -= netSum;
    }

    const debtors = [];
    const creditors = [];

    for (const item of entries) {
        if (item.balance < 0) {
            debtors.push({ user: item.user, amount: -item.balance });
        } else if (item.balance > 0) {
            creditors.push({ user: item.user, amount: item.balance });
        }
    }

    // 3. 依欠款與應收金額大到小排序 (貪婪撮合)
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const transactions = [];
    let i = 0, j = 0;

    while (i < debtors.length && j < creditors.length) {
        const settleAmount = Math.min(debtors[i].amount, creditors[j].amount);

        if (settleAmount > 0) {
            transactions.push({
                from: debtors[i].user,
                to: creditors[j].user,
                amount: settleAmount
            });
        }

        debtors[i].amount -= settleAmount;
        creditors[j].amount -= settleAmount;

        if (debtors[i].amount === 0) i++;
        if (creditors[j].amount === 0) j++;
    }

    return transactions;
}
