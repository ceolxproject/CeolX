import { Check, SlidersHorizontal, X } from 'lucide-react';
import type { ReactNode } from 'react';

import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from '@CeolX/ui/components/popover';
import { cn } from '@CeolX/ui/lib/utils';

// Persona is handled by the segment tabs, not here — these are the refinements.
export type UserFilters = {
  authMethod: string[];
  emailVerified?: boolean;
  flaggedInactive?: boolean;
  marketingConsent?: boolean;
  registeredFrom?: string;
  registeredTo?: string;
};

export const EMPTY_FILTERS: UserFilters = {
  authMethod: [],
};

const AUTH_OPTIONS = [
  { value: 'credential', label: 'Email / Password' },
  { value: 'google', label: 'Google' },
  { value: 'apple', label: 'Apple' },
];

const AUTH_LABEL: Record<string, string> = Object.fromEntries(
  AUTH_OPTIONS.map((o) => [o.value, o.label])
);

export function countActiveFilters(f: UserFilters): number {
  return (
    f.authMethod.length +
    (f.emailVerified !== undefined ? 1 : 0) +
    (f.flaggedInactive ? 1 : 0) +
    (f.marketingConsent ? 1 : 0) +
    (f.registeredFrom ? 1 : 0) +
    (f.registeredTo ? 1 : 0)
  );
}

const triggerClass =
  'inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-muted data-[popup-open]:bg-muted';

function CheckRow({
  checked,
  label,
  onClick,
}: {
  checked: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onClick}
      className="flex w-full items-center gap-2.5 py-1.5 text-left text-sm"
    >
      <span
        aria-hidden
        className={cn(
          'grid size-[18px] shrink-0 place-items-center rounded-[5px] border transition-colors',
          checked ? 'border-primary bg-primary text-white' : 'border-border'
        )}
      >
        {checked && <Check size={11} strokeWidth={3} />}
      </span>
      {label}
    </button>
  );
}

function Group({ label, full, children }: { label: string; full?: boolean; children: ReactNode }) {
  return (
    <div className={cn('px-4 py-3', full && 'col-span-2')}>
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

const dateClass =
  'min-w-0 flex-1 rounded-md border border-border bg-card px-2 py-1.5 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring';

export function UsersFilters({
  filters,
  onChange,
  resultCount,
}: {
  filters: UserFilters;
  onChange: (filters: UserFilters) => void;
  resultCount: number;
}) {
  const set = (patch: Partial<UserFilters>) => onChange({ ...filters, ...patch });
  const toggleAuth = (v: string) => {
    const next = filters.authMethod.includes(v)
      ? filters.authMethod.filter((x) => x !== v)
      : [...filters.authMethod, v];
    onChange({ ...filters, authMethod: next });
  };
  const active = countActiveFilters(filters);
  const today = new Date().toISOString().slice(0, 10);
  const rangeError = !!(
    filters.registeredFrom &&
    filters.registeredTo &&
    filters.registeredFrom > filters.registeredTo
  );

  return (
    <Popover>
      <PopoverTrigger className={triggerClass}>
        <SlidersHorizontal size={15} />
        Filters
        {active > 0 && (
          <span className="rounded-full bg-primary px-1.5 text-xs font-bold leading-5 text-white">
            {active}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[30rem] max-w-[calc(100vw-2rem)]">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="font-semibold">Filters</span>
          <PopoverClose
            aria-label="Close filters"
            className="-mr-1 grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X size={16} />
          </PopoverClose>
        </div>

        <div className="grid max-h-[70vh] grid-cols-2 overflow-y-auto [&>*]:border-border/60 [&>*:not(:last-child)]:border-b [&>*:nth-child(odd):not(:last-child)]:border-r">
          <Group label="Sign-in method">
            {AUTH_OPTIONS.map((o) => (
              <CheckRow
                key={o.value}
                label={o.label}
                checked={filters.authMethod.includes(o.value)}
                onClick={() => toggleAuth(o.value)}
              />
            ))}
          </Group>

          <Group label="Email">
            <CheckRow
              label="Verified"
              checked={filters.emailVerified === true}
              onClick={() =>
                set({ emailVerified: filters.emailVerified === true ? undefined : true })
              }
            />
            <CheckRow
              label="Unverified"
              checked={filters.emailVerified === false}
              onClick={() =>
                set({ emailVerified: filters.emailVerified === false ? undefined : false })
              }
            />
          </Group>

          <Group label="Flags">
            <CheckRow
              label="Inactive 24 months"
              checked={!!filters.flaggedInactive}
              onClick={() => set({ flaggedInactive: filters.flaggedInactive ? undefined : true })}
            />
            <CheckRow
              label="Marketing opt-in"
              checked={!!filters.marketingConsent}
              onClick={() => set({ marketingConsent: filters.marketingConsent ? undefined : true })}
            />
          </Group>

          <Group label="Joined" full>
            <div className="flex items-center gap-2">
              <input
                type="date"
                aria-label="Joined from"
                value={filters.registeredFrom ?? ''}
                max={filters.registeredTo || today}
                onChange={(e) => set({ registeredFrom: e.target.value || undefined })}
                className={cn(dateClass, rangeError && 'border-red-300 focus:ring-red-300')}
              />
              <span className="text-muted-foreground">–</span>
              <input
                type="date"
                aria-label="Joined to"
                value={filters.registeredTo ?? ''}
                min={filters.registeredFrom || undefined}
                max={today}
                onChange={(e) => set({ registeredTo: e.target.value || undefined })}
                className={cn(dateClass, rangeError && 'border-red-300 focus:ring-red-300')}
              />
            </div>
            {rangeError && (
              <p className="mt-1.5 text-xs text-red-600">
                The “from” date can’t be after the “to” date.
              </p>
            )}
          </Group>
        </div>

        <div className="flex gap-2 border-t border-border p-3">
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="flex-1 rounded-md border border-border bg-card py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            Clear
          </button>
          <PopoverClose className="flex-[2] rounded-md bg-primary py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90">
            Show {resultCount} {resultCount === 1 ? 'user' : 'users'}
          </PopoverClose>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 py-1 pl-2.5 pr-1 text-xs font-semibold text-primary">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="grid size-4 place-items-center rounded-full bg-primary/15 hover:bg-primary/25"
      >
        <X size={10} strokeWidth={3} />
      </button>
    </span>
  );
}

export function UserFilterChips({
  filters,
  onChange,
}: {
  filters: UserFilters;
  onChange: (filters: UserFilters) => void;
}) {
  const chips: Array<{ label: string; remove: () => void }> = [];

  filters.authMethod.forEach((m) =>
    chips.push({
      label: `Sign-in: ${AUTH_LABEL[m] ?? m}`,
      remove: () => onChange({ ...filters, authMethod: filters.authMethod.filter((x) => x !== m) }),
    })
  );
  if (filters.emailVerified !== undefined)
    chips.push({
      label: filters.emailVerified ? 'Email: Verified' : 'Email: Unverified',
      remove: () => onChange({ ...filters, emailVerified: undefined }),
    });
  if (filters.flaggedInactive)
    chips.push({
      label: 'Inactive 24 months',
      remove: () => onChange({ ...filters, flaggedInactive: undefined }),
    });
  if (filters.marketingConsent)
    chips.push({
      label: 'Marketing opt-in',
      remove: () => onChange({ ...filters, marketingConsent: undefined }),
    });
  if (filters.registeredFrom)
    chips.push({
      label: `From ${filters.registeredFrom}`,
      remove: () => onChange({ ...filters, registeredFrom: undefined }),
    });
  if (filters.registeredTo)
    chips.push({
      label: `To ${filters.registeredTo}`,
      remove: () => onChange({ ...filters, registeredTo: undefined }),
    });

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-muted-foreground">Filtering by</span>
      {chips.map((c) => (
        <Chip key={c.label} label={c.label} onRemove={c.remove} />
      ))}
      <button
        type="button"
        onClick={() => onChange(EMPTY_FILTERS)}
        className="text-xs font-medium text-muted-foreground underline transition-colors hover:text-foreground"
      >
        Clear all
      </button>
    </div>
  );
}
