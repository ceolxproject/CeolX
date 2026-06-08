import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Input } from '@CeolX/ui/components/input';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  debounceMs = 300,
}: SearchInputProps) {
  const [local, setLocal] = useState(value);

  // Hold the latest onChange in a ref so the debounce effect does not depend on
  // its (often inline, unstable) identity. Otherwise the effect re-runs on every
  // parent render and re-fires onChange, clobbering parent state (e.g. resetting
  // pagination back to page 1).
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Sync external value into the local input.
  useEffect(() => {
    setLocal(value);
  }, [value]);

  // Debounce: only emit when the local input actually diverges from the
  // controlled value, i.e. the user typed something. A plain re-render where
  // local === value must not fire onChange.
  useEffect(() => {
    if (local === value) return;
    const timer = setTimeout(() => onChangeRef.current(local), debounceMs);
    return () => clearTimeout(timer);
  }, [local, value, debounceMs]);

  return (
    <div className="relative">
      <Input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        className="pr-8"
      />
      {local && (
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={() => {
            setLocal('');
            onChange('');
          }}
          aria-label="Clear search"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
