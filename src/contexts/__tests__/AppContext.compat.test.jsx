import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

const mockData = {
    source: 'data',
    shared: 'from-data',
    ticketDomain: { tickets: ['t1'] },
};
const mockSync = {
    isSyncing: false,
    shared: 'from-sync',
};
const mockFilter = {
    renderError: null,
    shared: 'from-filter',
};

vi.mock('../DataContext', () => ({
    DataProvider: ({ children }) => <>{children}</>,
    useDataContext: () => mockData,
}));

vi.mock('../SyncContext', () => ({
    SyncProvider: ({ children }) => <>{children}</>,
    useSyncContext: () => mockSync,
}));

vi.mock('../UIContext', () => ({
    UIProvider: ({ children }) => <>{children}</>,
}));

vi.mock('../FilterContext', () => ({
    FilterProvider: ({ children }) => <>{children}</>,
    useFilterContext: () => mockFilter,
}));

import { AppProvider, useAppContext } from '../AppContext';

function Probe() {
    const value = useAppContext();
    return <pre data-testid="ctx">{JSON.stringify(value)}</pre>;
}

describe('AppContext compatibility layer', () => {
    it('merges data/sync/filter and keeps last-spread precedence', () => {
        const { getByTestId } = render(
            <AppProvider>
                <Probe />
            </AppProvider>
        );

        const parsed = JSON.parse(getByTestId('ctx').textContent || '{}');
        expect(parsed.source).toBe('data');
        expect(parsed.isSyncing).toBe(false);
        expect(parsed.renderError).toBeNull();
        expect(parsed.shared).toBe('from-filter');
        expect(parsed.ticketDomain.tickets).toEqual(['t1']);
    });
});
