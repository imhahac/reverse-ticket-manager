import { UIProvider } from './UIContext';
import { FilterProvider, useFilterContext } from './FilterContext';

const AppContext = createContext();

/**
 * AppProvider 建立完整的 Context 堆棧：
 * Data -> Sync -> UI -> Filter -> Facade (AppContext)
 */
export function AppProvider({ children }) {
    return (
        <DataProvider>
            <SyncProvider>
                <UIProvider>
                    <FilterProvider>
                        <AppContextFacade>{children}</AppContextFacade>
                    </FilterProvider>
                </UIProvider>
            </SyncProvider>
        </DataProvider>
    );
}

function AppContextFacade({ children }) {
    const data = useDataContext();
    const sync = useSyncContext();
    const filter = useFilterContext(); // 注意：這需要 FilterProvider 在外層
    
    // 組合所有的值作為原本的 AppContext 提供
    const value = {
        ...data,
        ...sync,
        ...filter
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
    return useContext(AppContext);
}
