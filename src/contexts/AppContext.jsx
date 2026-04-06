import React from 'react';
import { DataProvider, useDataContext } from './DataContext';
import { SyncProvider, useSyncContext } from './SyncContext';
import { UIProvider } from './UIContext';
import { FilterProvider, useFilterContext } from './FilterContext';

/**
 * AppProvider 建立完整的 Context 堆棧：
 * Data -> Sync -> UI -> Filter
 */
export function AppProvider({ children }) {
    return (
        <DataProvider>
            <SyncProvider>
                <UIProvider>
                    <FilterProvider>
                        {children}
                    </FilterProvider>
                </UIProvider>
            </SyncProvider>
        </DataProvider>
    );
}

/**
 * @deprecated 新程式碼請改用 Data/Sync/Filter/UI 的 selector hooks。
 * 僅保留給舊元件相容。
 */
export function useAppContext() {
    // 相容層：保留既有 API，避免舊元件一次性全面改寫。
    const data = useDataContext();
    const sync = useSyncContext();
    const filter = useFilterContext();
    return {
        ...data,
        ...sync,
        ...filter,
    };
}
