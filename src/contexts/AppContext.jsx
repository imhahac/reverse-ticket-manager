import React, { createContext, useContext } from 'react';
import { DataProvider, useDataContext } from './DataContext';
import { SyncProvider, useSyncContext } from './SyncContext';

const AppContext = createContext();

export function AppProvider({ children }) {
    return (
        <DataProvider>
            <SyncProvider>
                <AppContextFacade>{children}</AppContextFacade>
            </SyncProvider>
        </DataProvider>
    );
}

function AppContextFacade({ children }) {
    const data = useDataContext();
    const sync = useSyncContext();
    
    // 組合所有的值作為原本的 AppContext 提供
    const value = {
        ...data,
        ...sync
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
    return useContext(AppContext);
}
