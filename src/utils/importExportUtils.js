/**
 * importExportUtils.js
 * 獨立處理應用程式資料的 JSON 匯出入邏輯
 */

export const exportData = (tickets, tripLabels, rawHotels, activities, tripBudgets) => {
    const blob = new Blob([JSON.stringify({ tickets, tripLabels, hotels: rawHotels, activities, tripBudgets }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), {
        href: url,
        download: `travel-backup-${new Date().toISOString().split('T')[0]}.json`,
    }).click();
    URL.revokeObjectURL(url);
};

export const importData = (file, onSuccess, onError) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ({ target }) => {
        try {
            const data = JSON.parse(target.result);
            const newTickets = Array.isArray(data) ? data : (data.tickets || []);
            const newLabels  = data.tripLabels || {};
            const newBudgets = data.tripBudgets || {};
            const newHotels  = data.hotels || [];
            const newActivities = data.activities || [];
            
            // 更嚴謹的驗證：確保 tickets 必須是陣列，且內部每個元素都有 id
            if (!Array.isArray(newTickets)) throw new Error('Tickets 資料必須是陣列 (Array) 格式');
            if (newTickets.length > 0) {
                const isValid = newTickets.every(t => t && typeof t === 'object' && t.id);
                if (!isValid) throw new Error('部分機票資料遺漏了必要的 id 欄位，或者資料結構不正確');
            } else if (!data.tickets && !Array.isArray(data)) {
                throw new Error('無法識別的檔案格式：找不到 tickets 資料');
            }

            onSuccess({
                newTickets,
                newLabels,
                newBudgets,
                newHotels,
                newActivities
            });
        } catch (err) {
            onError(err);
        }
    };
    reader.readAsText(file);
};
