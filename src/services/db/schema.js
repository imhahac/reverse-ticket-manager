/**
 * schema.js
 * IndexedDB Schema 定義與版本管理
 */

export const DB_NAME = 'treklite_db';
export const DB_VERSION = 1;

export const STORES = {
    TRIPS: 'trips',
    DAY_PLANS: 'dayPlans',
    PLACE_ITEMS: 'placeItems',
    DAY_NOTES: 'dayNotes',
    RESERVATIONS: 'reservations',
    EXPENSES: 'expenses',
    PACKING_ITEMS: 'packingItems',
    TODOS: 'todos',
    ATTACHED_FILES: 'attachedFiles',
    APP_SETTINGS: 'appSettings',
    BACKUPS: 'backups'
};

export function setupIndexedDBSchema(db) {
    // 1. Trips
    if (!db.objectStoreNames.contains(STORES.TRIPS)) {
        const store = db.createObjectStore(STORES.TRIPS, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('startDate', 'startDate', { unique: false });
    }

    // 2. DayPlans
    if (!db.objectStoreNames.contains(STORES.DAY_PLANS)) {
        const store = db.createObjectStore(STORES.DAY_PLANS, { keyPath: 'id' });
        store.createIndex('tripId', 'tripId', { unique: false });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('tripId_dayIndex', ['tripId', 'dayIndex'], { unique: false });
    }

    // 3. PlaceItems
    if (!db.objectStoreNames.contains(STORES.PLACE_ITEMS)) {
        const store = db.createObjectStore(STORES.PLACE_ITEMS, { keyPath: 'id' });
        store.createIndex('dayPlanId', 'dayPlanId', { unique: false });
        store.createIndex('tripId', 'tripId', { unique: false });
        store.createIndex('orderIndex', 'orderIndex', { unique: false });
    }

    // 4. DayNotes
    if (!db.objectStoreNames.contains(STORES.DAY_NOTES)) {
        const store = db.createObjectStore(STORES.DAY_NOTES, { keyPath: 'id' });
        store.createIndex('dayPlanId', 'dayPlanId', { unique: false });
    }

    // 5. Reservations (16 Types)
    if (!db.objectStoreNames.contains(STORES.RESERVATIONS)) {
        const store = db.createObjectStore(STORES.RESERVATIONS, { keyPath: 'id' });
        store.createIndex('tripId', 'tripId', { unique: false });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('startDate', 'startDate', { unique: false });
    }

    // 6. Expenses
    if (!db.objectStoreNames.contains(STORES.EXPENSES)) {
        const store = db.createObjectStore(STORES.EXPENSES, { keyPath: 'id' });
        store.createIndex('tripId', 'tripId', { unique: false });
        store.createIndex('category', 'category', { unique: false });
    }

    // 7. Packing Items
    if (!db.objectStoreNames.contains(STORES.PACKING_ITEMS)) {
        const store = db.createObjectStore(STORES.PACKING_ITEMS, { keyPath: 'id' });
        store.createIndex('tripId', 'tripId', { unique: false });
        store.createIndex('category', 'category', { unique: false });
    }

    // 8. Todos
    if (!db.objectStoreNames.contains(STORES.TODOS)) {
        const store = db.createObjectStore(STORES.TODOS, { keyPath: 'id' });
        store.createIndex('tripId', 'tripId', { unique: false });
        store.createIndex('dueDate', 'dueDate', { unique: false });
    }

    // 9. Attached Files
    if (!db.objectStoreNames.contains(STORES.ATTACHED_FILES)) {
        const store = db.createObjectStore(STORES.ATTACHED_FILES, { keyPath: 'id' });
        store.createIndex('tripId', 'tripId', { unique: false });
        store.createIndex('parentId', 'parentId', { unique: false });
        store.createIndex('isTrash', 'isTrash', { unique: false });
    }

    // 10. App Settings
    if (!db.objectStoreNames.contains(STORES.APP_SETTINGS)) {
        db.createObjectStore(STORES.APP_SETTINGS, { keyPath: 'key' });
    }

    // 11. Backups
    if (!db.objectStoreNames.contains(STORES.BACKUPS)) {
        const store = db.createObjectStore(STORES.BACKUPS, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
    }
}
