/**
 * splitCalculator.js
 * 費用分攤演算法庫：
 * 採用最大餘數法 (Largest Remainder Method / Hamilton-Hare Method)
 * 徹底杜絕整數分除不盡導致的「斷頭分」(Penny Discrepancy) 與錯帳死結！
 */

/**
 * 等額分攤 (保證所有份額加總精確等於 totalCents)
 * @param {number} totalCents - 總金額 (以最小整數分計算)
 * @param {Array<string>} participantIds - 參與分攤的使用者 ID 陣列
 * @returns {Record<string, number>} { [userId]: shareInCents }
 */
export function splitEqual(totalCents, participantIds) {
    if (!participantIds || participantIds.length === 0) return {};
    const n = participantIds.length;
    const integerTotal = Math.round(totalCents);

    const baseShare = Math.floor(integerTotal / n);
    const remainder = integerTotal % n; // 剩餘零頭分

    const result = {};
    for (let i = 0; i < n; i++) {
        // 前 remainder 個人各多分配 1 分，保證總和絕對守恆
        result[participantIds[i]] = baseShare + (i < remainder ? 1 : 0);
    }
    return result;
}

/**
 * 依權重/比例分攤 (最大餘數法)
 * @param {number} totalCents
 * @param {Record<string, number>} weightsMap - { [userId]: weight } (例如 { Alice: 2, Bob: 1 })
 */
export function splitByWeights(totalCents, weightsMap) {
    const users = Object.keys(weightsMap);
    if (users.length === 0) return {};

    const totalWeight = users.reduce((sum, u) => sum + (weightsMap[u] || 0), 0);
    if (totalWeight <= 0) return splitEqual(totalCents, users);

    const integerTotal = Math.round(totalCents);
    const exactShares = [];

    let allocatedSum = 0;
    for (const u of users) {
        const exact = (integerTotal * (weightsMap[u] || 0)) / totalWeight;
        const integerPart = Math.floor(exact);
        const remainderPart = exact - integerPart;

        allocatedSum += integerPart;
        exactShares.push({ user: u, integerPart, remainderPart });
    }

    // 依小數部分降序排列，優先分配剩餘分
    exactShares.sort((a, b) => b.remainderPart - a.remainderPart);

    let centsLeft = integerTotal - allocatedSum;
    const result = {};

    for (let i = 0; i < exactShares.length; i++) {
        const addPenny = i < centsLeft ? 1 : 0;
        result[exactShares[i].user] = exactShares[i].integerPart + addPenny;
    }

    return result;
}

/**
 * 計算一群支出項目的各人淨餘額 (Net Balances)
 * 正數代表他人欠他 (Creditor，應收)，負數代表他欠他人 (Debtor，應付)
 * @param {Array<Object>} expenses
 * @returns {Record<string, number>} { [userId]: netBalanceCents }
 */
export function calculateNetBalances(expenses) {
    const balances = {};

    const addBalance = (user, amount) => {
        if (!user) return;
        balances[user] = (balances[user] || 0) + Math.round(amount);
    };

    for (const exp of expenses) {
        if (exp.settled) continue; // 已結清的不計入當前欠款

        // 1. 付款人 (加餘額)
        if (Array.isArray(exp.payers) && exp.payers.length > 0) {
            for (const p of exp.payers) {
                addBalance(p.userId, p.amount);
            }
        } else if (exp.paidBy) {
            // 單一付款人相容
            addBalance(exp.paidBy, exp.baseAmount || exp.amount);
        }

        // 2. 分攤人 (扣份額)
        if (exp.shares && typeof exp.shares === 'object') {
            for (const [user, shareAmount] of Object.entries(exp.shares)) {
                addBalance(user, -shareAmount);
            }
        }
    }

    // 清除微小浮動零頭
    for (const user of Object.keys(balances)) {
        if (Math.abs(balances[user]) < 0.001) {
            delete balances[user];
        }
    }

    return balances;
}
