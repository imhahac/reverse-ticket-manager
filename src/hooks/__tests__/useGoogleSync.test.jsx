import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGoogleSync } from '../useGoogleSync';
import { syncToDrive, loadFromDrive, syncToCalendar } from '../../utils/googleSync';

const { toastMock } = vi.hoisted(() => {
    const t = vi.fn();
    t.error = vi.fn();
    t.success = vi.fn();
    t.loading = vi.fn(() => 'toast-loading-id');
    t.dismiss = vi.fn();
    t.info = vi.fn();
    return { toastMock: t };
});

vi.mock('sonner', () => ({
    toast: toastMock,
}));

vi.mock('../../utils/googleSync', () => ({
    syncToDrive: vi.fn(),
    loadFromDrive: vi.fn(),
    syncToCalendar: vi.fn(),
}));

const getBaseProps = () => ({
    accessToken: 'token-1',
    accessTokenState: { token: 'token-1' },
    trySilentRefresh: vi.fn().mockResolvedValue(true),
    isTokenExpired: vi.fn(() => false),
    logout: vi.fn(),
    tickets: [],
    tripLabels: {},
    setTickets: vi.fn(),
    setTripLabels: vi.fn(),
    hotels: [],
    rawHotels: [],
    activities: [],
    segments: [],
    setHotels: vi.fn(),
    setActivities: vi.fn(),
    updateHotelCalendarIds: vi.fn(),
    updateActivityCalendarId: vi.fn(),
});

describe('useGoogleSync', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows error and aborts when user is not logged in', async () => {
        const props = {
            ...getBaseProps(),
            accessToken: null,
            accessTokenState: null,
        };
        const { result } = renderHook(() => useGoogleSync(props));

        await act(async () => {
            await result.current.handleSyncToDrive();
        });

        expect(toastMock.error).toHaveBeenCalledWith('請先登入 Google');
        expect(syncToDrive).not.toHaveBeenCalled();
    });

    it('logs out when token is expired and silent refresh fails before request', async () => {
        const props = {
            ...getBaseProps(),
            isTokenExpired: vi.fn(() => true),
            trySilentRefresh: vi.fn().mockResolvedValue(false),
            logout: vi.fn(),
        };
        const { result } = renderHook(() => useGoogleSync(props));

        await act(async () => {
            await result.current.handleSyncToDrive();
        });

        expect(props.trySilentRefresh).toHaveBeenCalledTimes(1);
        expect(props.logout).toHaveBeenCalledTimes(1);
        expect(syncToDrive).not.toHaveBeenCalled();
    });

    it('retries once when API returns expired and refresh succeeds', async () => {
        syncToDrive
            .mockResolvedValueOnce({ success: false, expired: true })
            .mockResolvedValueOnce({ success: true, fileId: 'drive-file-1' });

        const props = {
            ...getBaseProps(),
            trySilentRefresh: vi.fn().mockResolvedValue(true),
        };
        const { result } = renderHook(() => useGoogleSync(props));

        await act(async () => {
            await result.current.handleSyncToDrive();
        });

        expect(syncToDrive).toHaveBeenCalledTimes(2);
        expect(props.trySilentRefresh).toHaveBeenCalledTimes(1);
        expect(toastMock.success).toHaveBeenCalled();
    });

    it('deduplicates concurrent refresh calls across multiple sync handlers', async () => {
        let resolveRefresh;
        const refreshPromise = new Promise((resolve) => {
            resolveRefresh = resolve;
        });

        syncToDrive.mockResolvedValue({ success: true, fileId: 'f1' });
        loadFromDrive.mockResolvedValue({
            success: true,
            tickets: [],
            tripLabels: {},
            hotels: [],
            activities: [],
            foundFilesLog: 'reverse-tickets.json',
        });
        syncToCalendar.mockResolvedValue({ success: true, count: 0, deletedCount: 0 });

        const props = {
            ...getBaseProps(),
            isTokenExpired: vi.fn(() => true),
            trySilentRefresh: vi.fn(() => refreshPromise),
        };

        const { result } = renderHook(() => useGoogleSync(props));

        await act(async () => {
            const p1 = result.current.handleSyncToDrive();
            const p2 = result.current.handleLoadFromDrive();
            resolveRefresh(true);
            await Promise.all([p1, p2]);
        });

        expect(props.trySilentRefresh).toHaveBeenCalledTimes(1);
        expect(syncToDrive).toHaveBeenCalledTimes(1);
        expect(loadFromDrive).toHaveBeenCalledTimes(1);
    });
});
