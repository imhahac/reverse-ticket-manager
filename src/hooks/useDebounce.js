import { useState, useEffect } from 'react';

/**
 * useDebounce — 延遲更新 value，避免高頻操作（如搜索）觸發過多 re-render。
 * @param {*} value 原始值
 * @param {number} delay 延遲毫秒，預設 300ms
 * @returns 防抖後的值
 */
export function useDebounce(value, delay = 300) {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);

    return debouncedValue;
}
