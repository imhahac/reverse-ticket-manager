import { describe, it, expect, vi } from 'vitest';
import { createRefreshTokenManager, runSyncActionSafely } from '../googleSync/guard';

describe('googleSync guard -> createRefreshTokenManager', () => {
    it('deduplicates concurrent refresh calls (single-flight)', async () => {
        const refreshFn = vi.fn(async () => {
            await Promise.resolve();
            return true;
        });

        const refreshOnce = createRefreshTokenManager(refreshFn);
        const [r1, r2, r3] = await Promise.all([refreshOnce(), refreshOnce(), refreshOnce()]);

        expect(r1).toBe(true);
        expect(r2).toBe(true);
        expect(r3).toBe(true);
        expect(refreshFn).toHaveBeenCalledTimes(1);
    });

    it('allows next refresh after previous in-flight finishes', async () => {
        const refreshFn = vi.fn(async () => true);
        const refreshOnce = createRefreshTokenManager(refreshFn);

        await refreshOnce();
        await refreshOnce();

        expect(refreshFn).toHaveBeenCalledTimes(2);
    });

    it('returns false when refresh throws', async () => {
        const refreshFn = vi.fn(async () => {
            throw new Error('refresh failed');
        });
        const refreshOnce = createRefreshTokenManager(refreshFn);

        const result = await refreshOnce();
        expect(result).toBe(false);
    });
});

describe('googleSync guard -> runSyncActionSafely', () => {
    it('returns action result when success format is valid', async () => {
        const action = vi.fn(async () => ({ success: true, fileId: 'abc' }));
        const result = await runSyncActionSafely(action, 'token');

        expect(result).toEqual({ success: true, fileId: 'abc' });
    });

    it('normalizes invalid action result format', async () => {
        const action = vi.fn(async () => ({ fileId: 'abc' }));
        const result = await runSyncActionSafely(action, 'token');

        expect(result.success).toBe(false);
        expect(result.expired).toBe(false);
        expect(result.error).toBe('同步回傳格式不正確，請稍後再試。');
    });

    it('normalizes thrown error', async () => {
        const action = vi.fn(async () => {
            throw new Error('network down');
        });
        const result = await runSyncActionSafely(action, 'token');

        expect(result).toEqual({
            success: false,
            expired: false,
            error: 'network down',
        });
    });
});
