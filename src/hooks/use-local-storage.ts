
import { useState, useEffect } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
    // State to store our value
    // Pass initial state function to useState so logic is only executed once
    // State to store our value
    // Initialize with initialValue to avoid hydration mismatch
    const [storedValue, setStoredValue] = useState<T>(initialValue);

    // Read from local storage only on client side after mount
    useEffect(() => {
        try {
            const item = window.localStorage.getItem(key);
            if (item) {
                setStoredValue(JSON.parse(item));
            }
        } catch (error) {
            console.warn(`Error reading localStorage key "${key}":`, error);
        }
    }, [key]); // Re-run if key changes

    // Return a wrapped version of useState's setter function that ...
    // ... persists the new value to localStorage.
    const setValue = (value: T | ((val: T) => T)) => {
        try {
            // Allow value to be a function so we have same API as useState
            const valueToStore =
                value instanceof Function ? value(storedValue) : value;

            // Save state
            setStoredValue(valueToStore);

            // Save to local storage
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(key, JSON.stringify(valueToStore));
            }
        } catch (error) {
            console.warn(`Error setting localStorage key "${key}":`, error);
        }
    };

    // Listen for changes elsewhere or just rely on mount
    // The previous implementation had a logic here that reset state if key changed.
    // The new useEffect above handles mounting and key changes.
    // So we can remove the old useEffect logic that was here if it was just for synchronization.
    // However, if we want to support dynamic key changes updating from storage, the first useEffect covers it.


    return [storedValue, setValue];
}
