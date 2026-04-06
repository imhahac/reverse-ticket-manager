import { useLocalStorage } from './useLocalStorage';
import { STORAGE_KEYS } from '../constants/storageKeys';

const DEFAULT_OVERRIDES = {
    version: 1,
    segTripId: {},
    removedSegIds: [],
    tripOrder: [],
};

export function useTripOverrides() {
    const [overrides, setOverrides] = useLocalStorage(STORAGE_KEYS.TRIP_OVERRIDES, DEFAULT_OVERRIDES);

    const normalized = overrides && typeof overrides === 'object'
        ? { ...DEFAULT_OVERRIDES, ...overrides }
        : DEFAULT_OVERRIDES;

    const removeSegment = (segId) => {
        setOverrides(prev => {
            const p = prev && typeof prev === 'object' ? { ...DEFAULT_OVERRIDES, ...prev } : DEFAULT_OVERRIDES;
            const removed = new Set(p.removedSegIds || []);
            removed.add(segId);
            const segTripId = { ...(p.segTripId || {}) };
            delete segTripId[segId];
            return { ...p, segTripId, removedSegIds: Array.from(removed) };
        });
    };

    const restoreSegment = (segId) => {
        setOverrides(prev => {
            const p = prev && typeof prev === 'object' ? { ...DEFAULT_OVERRIDES, ...prev } : DEFAULT_OVERRIDES;
            const removed = new Set(p.removedSegIds || []);
            removed.delete(segId);
            return { ...p, removedSegIds: Array.from(removed) };
        });
    };

    const moveSegmentToTrip = (segId, tripId) => {
        setOverrides(prev => {
            const p = prev && typeof prev === 'object' ? { ...DEFAULT_OVERRIDES, ...prev } : DEFAULT_OVERRIDES;
            const removed = new Set(p.removedSegIds || []);
            removed.delete(segId);
            return {
                ...p,
                removedSegIds: Array.from(removed),
                segTripId: { ...(p.segTripId || {}), [segId]: tripId },
            };
        });
    };

    const clearAllOverrides = () => setOverrides(DEFAULT_OVERRIDES);

    return {
        overrides: normalized,
        setOverrides,
        removeSegment,
        restoreSegment,
        moveSegmentToTrip,
        clearAllOverrides,
    };
}

