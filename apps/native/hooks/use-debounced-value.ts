import { useEffect, useRef, useState } from 'react';

/**
 * Debounces a string value. Returns the debounced value that updates
 * after `delayMs` milliseconds of inactivity.
 */
export function useDebouncedValue(value: string, delayMs = 400): string {
  const [debounced, setDebounced] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!value.trim()) {
      setDebounced('');
      return;
    }
    timerRef.current = setTimeout(() => setDebounced(value.trim()), delayMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, delayMs]);

  return debounced;
}
