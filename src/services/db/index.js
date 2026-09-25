/**
 * db/index.js
 * IndexedDB 驅動核心，提供各業務實體的非同步 CRUD 與批次交易操作
 */

import { openDB } from 'idb';
import { DB_NAME, DB_VERSION, STORES, setupIndexedDBSchema } from './schema';

export { STORES, DB_NAME, DB_VERSION };

let dbPromise = null;

export async function getDB() {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                setupIndexedDBSchema(db);
            }
        });
    }
    return dbPromise;
}

// ── Generic Store Operations ──────────────────────────────────────────

async function getAll(storeName) {
    const db = await getDB();
    return db.getAll(storeName);
}

async function getById(storeName, id) {
    const db = await getDB();
    return db.get(storeName, id);
}

async function putItem(storeName, item) {
    const db = await getDB();
    const itemWithTimestamp = {
        ...item,
        updatedAt: item.updatedAt || Date.now()
    };
    await db.put(storeName, itemWithTimestamp);
    return itemWithTimestamp;
}

async function deleteItem(storeName, id) {
    const db = await getDB();
    return db.delete(storeName, id);
}

async function getByIndex(storeName, indexName, value) {
    const db = await getDB();
    return db.getAllFromIndex(storeName, indexName, value);
}

// ── Repositories ──────────────────────────────────────────────────────

export const tripRepo = {
    getAll: () => getAll(STORES.TRIPS),
    get: (id) => getById(STORES.TRIPS, id),
    save: (trip) => putItem(STORES.TRIPS, trip),
    delete: async (id) => {
        const db = await getDB();
        const tx = db.transaction([
            STORES.TRIPS,
            STORES.DAY_PLANS,
            STORES.PLACE_ITEMS,
            STORES.DAY_NOTES,
            STORES.RESERVATIONS,
            STORES.EXPENSES,
            STORES.PACKING_ITEMS,
            STORES.TODOS,
            STORES.ATTACHED_FILES
        ], 'readwrite');

        await tx.objectStore(STORES.TRIPS).delete(id);
        // Cascade delete related items
        const dayPlanIndex = tx.objectStore(STORES.DAY_PLANS).index('tripId');
        let cursor = await dayPlanIndex.openCursor(id);
        while (cursor) {
            await cursor.delete();
            cursor = await cursor.continue();
        }

        const resIndex = tx.objectStore(STORES.RESERVATIONS).index('tripId');
        let resCursor = await resIndex.openCursor(id);
        while (resCursor) {
            await resCursor.delete();
            resCursor = await resCursor.continue();
        }

        await tx.done;
        return true;
    }
};

export const dayPlanRepo = {
    getByTrip: (tripId) => getByIndex(STORES.DAY_PLANS, 'tripId', tripId),
    get: (id) => getById(STORES.DAY_PLANS, id),
    save: (dayPlan) => putItem(STORES.DAY_PLANS, dayPlan),
    delete: (id) => deleteItem(STORES.DAY_PLANS, id),
    saveBatch: async (dayPlans) => {
        const db = await getDB();
        const tx = db.transaction(STORES.DAY_PLANS, 'readwrite');
        for (const plan of dayPlans) {
            await tx.store.put({ ...plan, updatedAt: Date.now() });
        }
        await tx.done;
        return dayPlans;
    }
};

export const placeItemRepo = {
    getByDayPlan: (dayPlanId) => getByIndex(STORES.PLACE_ITEMS, 'dayPlanId', dayPlanId),
    getByTrip: (tripId) => getByIndex(STORES.PLACE_ITEMS, 'tripId', tripId),
    save: (place) => putItem(STORES.PLACE_ITEMS, place),
    delete: (id) => deleteItem(STORES.PLACE_ITEMS, id),
    saveBatch: async (places) => {
        const db = await getDB();
        const tx = db.transaction(STORES.PLACE_ITEMS, 'readwrite');
        for (const place of places) {
            await tx.store.put({ ...place, updatedAt: Date.now() });
        }
        await tx.done;
        return places;
    }
};

export const dayNoteRepo = {
    getByDayPlan: (dayPlanId) => getByIndex(STORES.DAY_NOTES, 'dayPlanId', dayPlanId),
    save: (note) => putItem(STORES.DAY_NOTES, note),
    delete: (id) => deleteItem(STORES.DAY_NOTES, id)
};

export const reservationRepo = {
    getByTrip: (tripId) => getByIndex(STORES.RESERVATIONS, 'tripId', tripId),
    get: (id) => getById(STORES.RESERVATIONS, id),
    save: (reservation) => putItem(STORES.RESERVATIONS, reservation),
    delete: (id) => deleteItem(STORES.RESERVATIONS, id),
    saveBatch: async (reservations) => {
        const db = await getDB();
        const tx = db.transaction(STORES.RESERVATIONS, 'readwrite');
        for (const res of reservations) {
            await tx.store.put({ ...res, updatedAt: Date.now() });
        }
        await tx.done;
        return reservations;
    }
};

export const expenseRepo = {
    getByTrip: (tripId) => getByIndex(STORES.EXPENSES, 'tripId', tripId),
    get: (id) => getById(STORES.EXPENSES, id),
    save: (expense) => putItem(STORES.EXPENSES, expense),
    delete: (id) => deleteItem(STORES.EXPENSES, id),
    saveBatch: async (expenses) => {
        const db = await getDB();
        const tx = db.transaction(STORES.EXPENSES, 'readwrite');
        for (const exp of expenses) {
            await tx.store.put({ ...exp, updatedAt: Date.now() });
        }
        await tx.done;
        return expenses;
    }
};

export const packingRepo = {
    getByTrip: (tripId) => getByIndex(STORES.PACKING_ITEMS, 'tripId', tripId),
    save: (item) => putItem(STORES.PACKING_ITEMS, item),
    delete: (id) => deleteItem(STORES.PACKING_ITEMS, id),
    saveBatch: async (items) => {
        const db = await getDB();
        const tx = db.transaction(STORES.PACKING_ITEMS, 'readwrite');
        for (const item of items) {
            await tx.store.put({ ...item, updatedAt: Date.now() });
        }
        await tx.done;
        return items;
    }
};

export const todoRepo = {
    getByTrip: (tripId) => getByIndex(STORES.TODOS, 'tripId', tripId),
    save: (todo) => putItem(STORES.TODOS, todo),
    delete: (id) => deleteItem(STORES.TODOS, id),
    saveBatch: async (todos) => {
        const db = await getDB();
        const tx = db.transaction(STORES.TODOS, 'readwrite');
        for (const td of todos) {
            await tx.store.put({ ...td, updatedAt: Date.now() });
        }
        await tx.done;
        return todos;
    }
};

export const fileRepo = {
    getByParent: (parentId) => getByIndex(STORES.ATTACHED_FILES, 'parentId', parentId),
    getByTrip: (tripId) => getByIndex(STORES.ATTACHED_FILES, 'tripId', tripId),
    save: (file) => putItem(STORES.ATTACHED_FILES, file),
    moveToTrash: async (id) => {
        const file = await getById(STORES.ATTACHED_FILES, id);
        if (file) {
            await putItem(STORES.ATTACHED_FILES, {
                ...file,
                isTrash: true,
                trashedAt: Date.now()
            });
        }
    },
    restore: async (id) => {
        const file = await getById(STORES.ATTACHED_FILES, id);
        if (file) {
            await putItem(STORES.ATTACHED_FILES, {
                ...file,
                isTrash: false,
                trashedAt: null
            });
        }
    },
    permanentDelete: (id) => deleteItem(STORES.ATTACHED_FILES, id)
};

export const settingsRepo = {
    get: async (key, defaultValue = null) => {
        const db = await getDB();
        const res = await db.get(STORES.APP_SETTINGS, key);
        return res ? res.value : defaultValue;
    },
    set: async (key, value) => {
        const db = await getDB();
        await db.put(STORES.APP_SETTINGS, { key, value, updatedAt: Date.now() });
        return value;
    }
};

export const backupRepo = {
    getAll: () => getAll(STORES.BACKUPS),
    createBackup: async (label, payload) => {
        const db = await getDB();
        const id = 'backup_' + Date.now();
        const item = {
            id,
            label,
            createdAt: Date.now(),
            payload
        };
        await db.put(STORES.BACKUPS, item);
        return item;
    },
    get: (id) => getById(STORES.BACKUPS, id),
    delete: (id) => deleteItem(STORES.BACKUPS, id)
};
