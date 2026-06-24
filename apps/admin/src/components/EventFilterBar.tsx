import { Check, SlidersHorizontal, X } from 'lucide-react';
import type { ReactNode } from 'react';

import { EVENT_CATEGORIES, type EventCategory } from '@CeolX/shared/enums';
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from '@CeolX/ui/components/popover';
import { cn } from '@CeolX/ui/lib/utils';

// Status is handled by the segment tabs, not here — these are the refinements.
export type EventFilters = {
  persona?: 'artist' | 'venue';
  categories: EventCategory[];
  createdFrom?: string;
  createdTo?: string;
};

export const EMPTY_EVENT_FILTERS: EventFilters = { categories: [] };

const PERSONA_OPTIONS = [
  { value: 'artist', label: 'Artists' },
  { value: 'venue', label: 'Venues' },
] as const;

const PERSONA_LABEL: Record<string, string> = Object.fromEntries(
  PERSONA_OPTIONS.map((o) => [o.value, o.label])
);

export function countActiveEventFilters(f: EventFilters): number {
  return (
    (f.persona ? 1 : 0) + f.categories.length + (f.createdFrom ? 1 : 0) + (f.createdTo ? 1 : 0)
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

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-b border-border/60 px-4 py-3 last:border-b-0">
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

const dateClass =
  'min-w-0 flex-1 rounded-md border border-border bg-card px-2 py-1.5 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring';

export function EventFilters({
  filters,
  onChange,
  resultCount,
}: {
  filters: EventFilters;
  onChange: (filters: EventFilters) => void;
  resultCount: number;
}) {
  const set = (patch: Partial<EventFilters>) => onChange({ ...filters, ...patch });
  const togglePersona = (v: 'artist' | 'venue') =>
    set({ persona: filters.persona === v ? undefined : v });
  const toggleCategory = (c: EventCategory) =>
    set({
      categories: filters.categories.includes(c)
        ? filters.categories.filter((x) => x !== c)
        : [...filters.categories, c],
    });
  const active = countActiveEventFilters(filters);
  const today = new Date().toISOString().slice(0, 10);
  const rangeError = !!(
    filters.createdFrom &&
    filters.createdTo &&
    filters.createdFrom > filters.createdTo
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
      <PopoverContent align="start" className="w-[26rem] max-w-[calc(100vw-2rem)]">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="font-semibold">Filters</span>
          <PopoverClose
            aria-label="Close filters"
            className="-mr-1 grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X size={16} />
          </PopoverClose>
        </div>

        <div className="max-h-[70vh] overflow-y-auto">
          <Group label="Created by">
            {PERSONA_OPTIONS.map((o) => (
              <CheckRow
                key={o.value}
                label={o.label}
                checked={filters.persona === o.value}
                onClick={() => togglePersona(o.value)}
              />
            ))}
          </Group>

          <Group label="Category">
            <div className="grid grid-cols-2 gap-x-3">
              {EVENT_CATEGORIES.map((c) => (
                <CheckRow
                  key={c}
                  label={c}
                  checked={filters.categories.includes(c)}
                  onClick={() => toggleCategory(c)}
                />
              ))}
            </div>
          </Group>

          <Group label="Submitted">
            <div className="flex items-center gap-2">
              <input
                type="date"
                aria-label="Submitted from"
                value={filters.createdFrom ?? ''}
                max={filters.createdTo || today}
                onChange={(e) => set({ createdFrom: e.target.value || undefined })}
                className={cn(dateClass, rangeError && 'border-red-300 focus:ring-red-300')}
              />
              <span className="text-muted-foreground">–</span>
              <input
                type="date"
                aria-label="Submitted to"
                value={filters.createdTo ?? ''}
                min={filters.createdFrom || undefined}
                max={today}
                onChange={(e) => set({ createdTo: e.target.value || undefined })}
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
            onClick={() => onChange(EMPTY_EVENT_FILTERS)}
            className="flex-1 rounded-md border border-border bg-card py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            Clear
          </button>
          <PopoverClose className="flex-[2] rounded-md bg-primary py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90">
            Show {resultCount} {resultCount === 1 ? 'event' : 'events'}
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

export function EventFilterChips({
  filters,
  onChange,
}: {
  filters: EventFilters;
  onChange: (filters: EventFilters) => void;
}) {
  const chips: Array<{ label: string; remove: () => void }> = [];

  if (filters.persona)
    chips.push({
      label: `Created by: ${PERSONA_LABEL[filters.persona]}`,
      remove: () => onChange({ ...filters, persona: undefined }),
    });
  filters.categories.forEach((c) =>
    chips.push({
      label: c,
      remove: () => onChange({ ...filters, categories: filters.categories.filter((x) => x !== c) }),
    })
  );
  if (filters.createdFrom)
    chips.push({
      label: `From ${filters.createdFrom}`,
      remove: () => onChange({ ...filters, createdFrom: undefined }),
    });
  if (filters.createdTo)
    chips.push({
      label: `To ${filters.createdTo}`,
      remove: () => onChange({ ...filters, createdTo: undefined }),
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
        onClick={() => onChange(EMPTY_EVENT_FILTERS)}
        className="text-xs font-medium text-muted-foreground underline transition-colors hover:text-foreground"
      >
        Clear all
      </button>
    </div>
  );
}
