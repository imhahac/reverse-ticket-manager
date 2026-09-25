/**
 * diagnosticDump.js
 * 零成本客戶端除錯診斷包 (Zero-Cost Client Diagnostic Dump) 產生器：
 * 當使用者在行動端或離線環境遭遇非預期錯誤或資料異常時，
 * 可一鍵匯出系統狀態、IndexedDB 統計、瀏覽器環境與日誌軌跡，供開發與維運團隊即時除錯排查。
 */

import { getDB, STORES } from '../services/db';

export async function generateDiagnosticReport() {
    const report = {
        generatedAt: new Date().toISOString(),
        environment: {
            userAgent: navigator.userAgent,
            language: navigator.language,
            isOnline: navigator.onLine,
            screen: {
                width: window.innerWidth,
                height: window.innerHeight,
                devicePixelRatio: window.devicePixelRatio
            },
            url: window.location.href,
            pathname: window.location.pathname
        },
        storage: {
            indexedDBAvailable: typeof indexedDB !== 'undefined',
            localStorageKeyCount: 0,
            storesRecordCount: {}
        }
    };

    // 1. 統計 localStorage 鍵值
    try {
        report.storage.localStorageKeyCount = localStorage.length;
        report.storage.localStorageKeys = Object.keys(localStorage);
    } catch (e) {
        report.storage.localStorageError = e.message;
    }

    // 2. 統計 IndexedDB 11 個 Stores 之健康狀態與記錄筆數
    try {
        const db = await getDB();
        for (const [storeKey, storeName] of Object.entries(STORES)) {
            try {
                const count = await db.count(storeName);
                report.storage.storesRecordCount[storeName] = count;
            } catch (err) {
                report.storage.storesRecordCount[storeName] = `Error: ${err.message}`;
            }
        }
    } catch (dbErr) {
        report.storage.indexedDBError = dbErr.message;
    }

    return report;
}

/**
 * 觸發下載診斷包 JSON 檔案
 */
export async function downloadDiagnosticDump() {
    const report = await generateDiagnosticReport();
    const jsonString = JSON.stringify(report, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trek-diagnostic-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
