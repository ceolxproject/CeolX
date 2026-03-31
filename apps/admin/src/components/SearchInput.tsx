import { X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

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

  const debouncedOnChange = useCallback(
    (val: string) => {
      const timer = setTimeout(() => onChange(val), debounceMs);
      return () => clearTimeout(timer);
    },
    [onChange, debounceMs]
  );

  useEffect(() => {
    const cleanup = debouncedOnChange(local);
    return cleanup;
  }, [local, debouncedOnChange]);

  useEffect(() => {
    setLocal(value);
  }, [value]);

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
