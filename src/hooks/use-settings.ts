'use client';

import { useState, useCallback } from 'react';

// A helper function to safely get items from localStorage
function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
    const [storedValue, setStoredValue] = useState<T>(() => {
        if (typeof window === 'undefined') {
            return initialValue;
        }
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(error);
            return initialValue;
        }
    });

    const setValue = useCallback((value: T) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(key, JSON.stringify(valueToStore));
            }
        } catch (error) {
            console.error(error);
        }
    }, [key, storedValue]);

    return [storedValue, setValue];
}

export function useSettings() {
    const [autoLoadKnowledge, setAutoLoadKnowledge] = useLocalStorage<boolean>('settings:autoLoadKnowledge', false);
    
    return {
        autoLoadKnowledge,
        setAutoLoadKnowledge
    };
}
