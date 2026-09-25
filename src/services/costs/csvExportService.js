/**
 * csvExportService.js
 * 費用報表與結算紀錄 CSV 匯出服務 (支援 UTF-8 BOM 避免 Excel 亂碼)
 */

export function generateExpensesCsvContent(tripTitle, expenses, settlementTransactions = []) {
    const BOM = '\uFEFF'; // Excel UTF-8 BOM

    let csv = BOM;
    csv += `旅程名稱,${tripTitle || '未命名旅程'}\n`;
    csv += `匯出日期,${new Date().toLocaleDateString('zh-TW')}\n\n`;

    // 1. 支出清單表格
    csv += '日期,項目名稱,分類,原幣金額,幣別,凍結匯率,換算基準金額(TWD),付款人,分攤方式,狀態\n';

    expenses.forEach(exp => {
        const date = exp.date || exp.createdAt ? new Date(exp.createdAt).toISOString().slice(0, 10) : '';
        const title = `"${(exp.title || '').replace(/"/g, '""')}"`;
        const category = exp.category || '一般';
        const origAmt = exp.amount || 0;
        const currency = exp.currency || 'TWD';
        const rate = exp.rateToTripBase || 1;
        const baseAmt = exp.baseAmount || origAmt;
        const paidBy = exp.paidBy || '';
        const splitType = exp.splitType === 'equal' ? '等額平分' : '自訂';
        const status = exp.settled ? '已結清' : '未結清';

        csv += `${date},${title},${category},${origAmt},${currency},${rate},${baseAmt},${paidBy},${splitType},${status}\n`;
    });

    // 2. 結算建議與清帳方案
    if (settlementTransactions.length > 0) {
        csv += '\n=== 智慧清帳還款建議 ===\n';
        csv += '應還款人,應收款人,還款金額(TWD)\n';
        settlementTransactions.forEach(t => {
            csv += `${t.from},${t.to},${t.amount}\n`;
        });
    }

    return csv;
}

export function exportExpensesToCSV(tripTitle, expenses, settlementTransactions = []) {
    const csv = generateExpensesCsvContent(tripTitle, expenses, settlementTransactions);
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
