import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
    getDB,
    STORES,
    tripRepo,
    dayPlanRepo,
    placeItemRepo,
    dayNoteRepo,
    reservationRepo,
    expenseRepo,
    packingRepo,
    todoRepo,
    fileRepo
} from '../index';

describe('tripRepo.delete - 9-Store Cascade Deletion Verification', () => {
    beforeEach(async () => {
        const db = await getDB();
        const allStores = Object.values(STORES);
        const tx = db.transaction(allStores, 'readwrite');
        for (const store of allStores) {
            await tx.objectStore(store).clear();
        }
        await tx.done;
    });

    it('應在刪除旅程時，徹底級聯清除關聯之全部 9 個 Store，不殘留任何孤兒數據', async () => {
        const tripA = 'trip_target_delete';
        const tripB = 'trip_preserve_other';

        // 1. 為 Trip A 寫入全套關聯資料
        await tripRepo.save({ id: tripA, title: '預計刪除的旅程' });
        await dayPlanRepo.save({ id: 'dp_a1', tripId: tripA, date: '2026-05-01' });
        await placeItemRepo.save({ id: 'place_a1', tripId: tripA, dayPlanId: 'dp_a1', title: '東京鐵塔' });
        await dayNoteRepo.save({ id: 'note_a1', dayPlanId: 'dp_a1', content: '記得帶傘' });
        await reservationRepo.save({ id: 'res_a1', tripId: tripA, type: 'flight' });
        await expenseRepo.save({ id: 'exp_a1', tripId: tripA, amount: 5000 });
        await packingRepo.save({ id: 'pack_a1', tripId: tripA, name: '護照' });
        await todoRepo.save({ id: 'todo_a1', tripId: tripA, title: '換日幣' });
        await fileRepo.save({ id: 'file_a1', tripId: tripA, fileName: 'ticket.pdf' });

        // 2. 為 Trip B 寫入干擾資料，確認不會被誤刪
        await tripRepo.save({ id: tripB, title: '應保留的旅程' });
        await dayPlanRepo.save({ id: 'dp_b1', tripId: tripB, date: '2026-06-01' });
        await placeItemRepo.save({ id: 'place_b1', tripId: tripB, dayPlanId: 'dp_b1', title: '巴黎鐵塔' });
        await dayNoteRepo.save({ id: 'note_b1', dayPlanId: 'dp_b1', content: '買博物館通票' });
        await reservationRepo.save({ id: 'res_b1', tripId: tripB, type: 'hotel' });
        await expenseRepo.save({ id: 'exp_b1', tripId: tripB, amount: 12000 });
        await packingRepo.save({ id: 'pack_b1', tripId: tripB, name: '萬國轉接頭' });
        await todoRepo.save({ id: 'todo_b1', tripId: tripB, title: '辦理簽證' });
        await fileRepo.save({ id: 'file_b1', tripId: tripB, fileName: 'hotel.pdf' });

        // 3. 執行 Trip A 級聯物理刪除
        const deleted = await tripRepo.delete(tripA);
        expect(deleted).toBe(true);

        // 4. 驗證 Trip A 在所有 Store 均嚴格清空 (0 殘留)
        expect(await tripRepo.get(tripA)).toBeUndefined();
        expect(await dayPlanRepo.getByTrip(tripA)).toHaveLength(0);
        expect(await placeItemRepo.getByTrip(tripA)).toHaveLength(0);
        expect(await dayNoteRepo.getByDayPlan('dp_a1')).toHaveLength(0);
        expect(await reservationRepo.getByTrip(tripA)).toHaveLength(0);
        expect(await expenseRepo.getByTrip(tripA)).toHaveLength(0);
        expect(await packingRepo.getByTrip(tripA)).toHaveLength(0);
        expect(await todoRepo.getByTrip(tripA)).toHaveLength(0);
        expect(await fileRepo.getByTrip(tripA)).toHaveLength(0);

        // 5. 驗證 Trip B 資料完好如初
        expect(await tripRepo.get(tripB)).toBeDefined();
        expect(await dayPlanRepo.getByTrip(tripB)).toHaveLength(1);
        expect(await placeItemRepo.getByTrip(tripB)).toHaveLength(1);
        expect(await dayNoteRepo.getByDayPlan('dp_b1')).toHaveLength(1);
        expect(await reservationRepo.getByTrip(tripB)).toHaveLength(1);
        expect(await expenseRepo.getByTrip(tripB)).toHaveLength(1);
        expect(await packingRepo.getByTrip(tripB)).toHaveLength(1);
        expect(await todoRepo.getByTrip(tripB)).toHaveLength(1);
        expect(await fileRepo.getByTrip(tripB)).toHaveLength(1);
    });
});
