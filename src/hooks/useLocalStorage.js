import { useState, useCallback } from "react";

/**
 * useLocalStorage ── 帶持久化的 useState
 *
 * 修正：
 *  - setValue(null) 現在會從 localStorage **移除**該 key，
 *    確保下次初始化能正確回傳 initialValue（不再出現 storedValue 為 null
 *    但 initialValue 為 [] 的不一致狀態）。
 *  - 初始化時，null / undefined 皆 fallback 到 initialValue。
 */
export function useLocalStorage(key, initialValue) {
    const [storedValue, setStoredValue] = useState(() => {
        if (typeof window === "undefined") {
            return initialValue;
        }
        try {
            const item = window.localStorage.getItem(key);
            if (item === null || item === undefined) return initialValue;
            const parsed = JSON.parse(item);
            return (parsed === null || parsed === undefined) ? initialValue : parsed;
        } catch (error) {
            console.warn(`Error reading localStorage key "${key}":`, error);
            return initialValue;
        }
    });

    const setValue = useCallback((value) => {
        try {
            setStoredValue((prevStoredValue) => {
                const valueToStore = value instanceof Function ? value(prevStoredValue) : value;

                if (typeof window !== "undefined") {
                    if (valueToStore === null || valueToStore === undefined) {
                        // null 表示「清除」，直接移除 key，
                        // 下次初始化會乾淨地回傳 initialValue
                        window.localStorage.removeItem(key);
                    } else {
                        window.localStorage.setItem(key, JSON.stringify(valueToStore));
                    }
                }
                
                return valueToStore;
            });
        } catch (error) {
            console.warn(`Error setting localStorage key "${key}":`, error);
        }
    }, [key]);

    return [storedValue, setValue];
}
