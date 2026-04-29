export const createStableId = (prefix = '') => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `${prefix}${crypto.randomUUID()}`;
    }

    const randomPart = Math.random().toString(36).slice(2, 10);
    return `${prefix}${Date.now()}-${randomPart}`;
};
