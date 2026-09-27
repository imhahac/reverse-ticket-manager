/**
 * csvExportService.js
 * 費用報表與結算紀錄 CSV 匯出服務 (支援 UTF-8 BOM 避免 Excel 亂碼)
 * 具備 RFC 4180 標準跳脫與 CSV Formula Injection (CWE-1236) 防禦機制
 */

/**
 * 針對 CSV 儲存格進行安全性跳脫與公式注入防禦
 * @param {any} val - 欲寫入儲存格的原始內容
 * @returns {string} 符合安全規範之 CSV 儲存格字串
 */
export function sanitizeCsvCell(val) {
    if (val === null || val === undefined) return '';
    let str = String(val);

    // 防禦 CSV Formula Injection (DDE / 試算表公式執行攻擊)
    // 若內容以 =、+、-、@、\t、\r 開頭，在前綴加上單引號避免被 Excel/Sheets 當成指令執行
    if (/^[=+\-@\t\r]/.test(str)) {
        str = `'${str}`;
    }

    // 若包含雙引號、逗號或換行，依 RFC 4180 規範用雙引號包裹並將內部雙引號成對跳脫
    if (/[",\n\r]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }

    return str;
}

export function generateExpensesCsvContent(tripTitle, expenses, settlementTransactions = [], baseCurrency = 'TWD') {
    const BOM = '\uFEFF'; // Excel UTF-8 BOM

    let csv = BOM;
    csv += `旅程名稱,${sanitizeCsvCell(tripTitle || '未命名旅程')}\n`;
    csv += `匯出日期,${new Date().toLocaleDateString('zh-TW')}\n\n`;

    // 1. 支出清單表格
    csv += `日期,項目名稱,分類,原幣金額,幣別,凍結匯率,換算基準金額(${baseCurrency}),付款人,分攤方式,狀態\n`;

    expenses.forEach(exp => {
        const date = exp.date || (exp.createdAt ? new Date(exp.createdAt).toISOString().slice(0, 10) : '');
        const title = sanitizeCsvCell(exp.title || '');
        const category = sanitizeCsvCell(exp.category || '一般');
        const origAmt = exp.amount || 0;
        const currency = exp.currency || baseCurrency;
        const rate = exp.rateToTripBase || 1;
        const baseAmt = exp.baseAmount || origAmt;
        const paidBy = sanitizeCsvCell(exp.paidBy || '');
        const splitType = sanitizeCsvCell(exp.splitType === 'equal' ? '等額平分' : '自訂');
        const status = exp.settled ? '已結清' : '未結清';

        csv += `${date},${title},${category},${origAmt},${currency},${rate},${baseAmt},${paidBy},${splitType},${status}\n`;
    });

    // 2. 結算建議與清帳方案
    if (settlementTransactions.length > 0) {
        csv += '\n=== 智慧清帳還款建議 ===\n';
        csv += `應還款人,應收款人,還款金額(${baseCurrency})\n`;
        settlementTransactions.forEach(t => {
            csv += `${sanitizeCsvCell(t.from)},${sanitizeCsvCell(t.to)},${t.amount}\n`;
        });
    }

    return csv;
}

export function exportExpensesToCSV(tripTitle, expenses, settlementTransactions = [], baseCurrency = 'TWD') {
    const csv = generateExpensesCsvContent(tripTitle, expenses, settlementTransactions, baseCurrency);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${tripTitle || 'Trip'}_費用清冊_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
