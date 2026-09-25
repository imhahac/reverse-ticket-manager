import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { generateDiagnosticReport } from '../diagnosticDump';
import { getDB, STORES } from '../../services/db';

describe('diagnosticDump - Zero-Cost Diagnostic Report Generator', () => {
    beforeEach(async () => {
        const db = await getDB();
        const tx = db.transaction(Object.values(STORES), 'readwrite');
        for (const storeName of Object.values(STORES)) {
            await tx.objectStore(storeName).clear();
        }
        await tx.done;
    });

    it('should generate structured diagnostic report with environment and storage statistics', async () => {
        // Insert a dummy trip into IndexedDB
        const db = await getDB();
        await db.put(STORES.TRIPS, {
            id: 'trip_diag_1',
            title: '診斷測試旅程',
            startDate: '2026-05-01',
            endDate: '2026-05-05'
        });

        const report = await generateDiagnosticReport();

        // 1. Report Timestamp
        expect(report.generatedAt).toBeDefined();
        expect(new Date(report.generatedAt).getTime()).not.toBeNaN();

        // 2. Client Environment
        expect(report.environment).toBeDefined();
        expect(report.environment.userAgent).toBeDefined();
        expect(typeof report.environment.isOnline).toBe('boolean');

        // 3. Storage & IndexedDB 11 Stores Counts
        expect(report.storage).toBeDefined();
        expect(report.storage.indexedDBAvailable).toBe(true);
        expect(report.storage.storesRecordCount).toBeDefined();

        // Verify all 11 stores are counted
        for (const storeName of Object.values(STORES)) {
            expect(report.storage.storesRecordCount[storeName]).toBeDefined();
        }

        // Verify the inserted trip is counted
        expect(report.storage.storesRecordCount[STORES.TRIPS]).toBe(1);
        expect(report.storage.storesRecordCount[STORES.EXPENSES]).toBe(0);
    });
});
