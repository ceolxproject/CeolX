import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ChevronDown, ChevronRight, ChevronsUpDown, ChevronUp, ImageOff } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@CeolX/ui/components/button';
import { Skeleton } from '@CeolX/ui/components/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@CeolX/ui/components/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@CeolX/ui/components/tooltip';
import { cn } from '@CeolX/ui/lib/utils';

import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { EventDetailSheet, type ListedEvent } from '../../../components/EventDetailSheet';
import {
  countActiveEventFilters,
  EMPTY_EVENT_FILTERS,
  EventFilterChips,
  EventFilters,
} from '../../../components/EventFilterBar';
import { RemoveReasonDialog } from '../../../components/RemoveReasonDialog';
import { SearchInput } from '../../../components/SearchInput';
import { StatusBadge } from '../../../components/StatusBadge';
import { formatDateTime, relativeTime } from '../../../lib/format';
import { queryClient, trpc } from '../../../utils/trpc';

export const Route = createFileRoute('/_admin/events/moderation')({
  // `createdBy` (+ optional `eventId`) arrive from a user's detail sheet — deep
  // link to one creator's events, optionally auto-opening a specific event.
  validateSearch: (search: Record<string, unknown>): { createdBy?: string; eventId?: string } => ({
    createdBy: typeof search.createdBy === 'string' ? search.createdBy : undefined,
    eventId: typeof search.eventId === 'string' ? search.eventId : undefined,
  }),
  component: EventModerationPage,
});

type StatusFilter = 'all' | 'active' | 'removed' | 'archived';
type SortField = 'createdAt' | 'title';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 20;
const COL_COUNT = 6;
const SKELETON_ROWS = 8;

const TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Live' },
  { value: 'removed', label: 'Removed' },
  { value: 'archived', label: 'Archived' },
];

function EventModerationPage() {
  const { createdBy, eventId } = Route.useSearch();
  // Arriving from a user's events list → show every status so the linked event
  // is visible regardless of state (the default Live tab would hide removed ones).
  const [status, setStatus] = useState<StatusFilter>(createdBy ? 'all' : 'active');
  const [filters, setFilters] = useState<EventFilters>(EMPTY_EVENT_FILTERS);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [removeTarget, setRemoveTarget] = useState<ListedEvent | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<ListedEvent | null>(null);
  const [detailTarget, setDetailTarget] = useState<ListedEvent | null>(null);
  const openedEventRef = useRef<string | null>(null);

  const { data: counts } = useQuery(trpc.admin.eventModerationCounts.queryOptions());

  const listQuery = useQuery(
    trpc.admin.listEvents.queryOptions({
      status: status === 'all' ? undefined : status,
      persona: filters.persona,
      q: q || undefined,
      category: filters.categories.length ? filters.categories : undefined,
      createdFrom: filters.createdFrom,
      createdTo: filters.createdTo,
      createdBy,
      sortBy,
      sortDir,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    })
  );

  function invalidate() {
    void queryClient.invalidateQueries(trpc.admin.listEvents.queryFilter());
    void queryClient.invalidateQueries(trpc.admin.eventModerationCounts.queryFilter());
  }

  const removeMutation = useMutation(
    trpc.admin.removeEvent.mutationOptions({
      onSuccess: () => {
        toast.success('Event removed. The creator has been notified.');
        invalidate();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const restoreMutation = useMutation(
    trpc.admin.restoreEvent.mutationOptions({
      onSuccess: () => {
        toast.success('Event restored. It is live on the map again.');
        invalidate();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  function handleConfirmRemove(reason: string) {
    if (!removeTarget) return;
    removeMutation.mutate({ id: removeTarget.id, removalReason: reason });
    setRemoveTarget(null);
    setDetailTarget(null);
  }

  function handleRestore(id: string) {
    restoreMutation.mutate({ id });
    setDetailTarget(null);
  }

  function changeStatus(next: StatusFilter) {
    setStatus(next);
    setPage(1);
  }

  function updateFilters(next: EventFilters) {
    setFilters(next);
    setPage(1);
  }

  function handleSort(key: SortField) {
    if (sortBy === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDir('asc');
    }
    setPage(1);
  }

  const events = useMemo(() => listQuery.data?.events ?? [], [listQuery.data]);
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const activeFilterCount = countActiveEventFilters(filters);
  const isFiltered = !!q || activeFilterCount > 0 || !!createdBy;
  const creatorName = createdBy ? (events[0]?.creator.name ?? null) : null;

  // Auto-open the event deep-linked from a user's sheet, once it lands in the list.
  useEffect(() => {
    if (!eventId || openedEventRef.current === eventId) return;
    const match = events.find((e) => e.id === eventId);
    if (match) {
      setDetailTarget(match);
      openedEventRef.current = eventId;
    }
  }, [eventId, events]);

  const tabCount = (s: StatusFilter) =>
    s === 'all' ? counts && counts.active + counts.removed + counts.archived : counts?.[s];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold">Event Moderation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review content that&rsquo;s live across CeolX. Remove anything that breaks policy — the
          creator is notified and can edit and resubmit.
        </p>
      </div>

      <div className="inline-flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => changeStatus(t.value)}
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors',
              status === t.value
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
            <span
              className={cn(
                'text-[11px] font-bold tabular-nums',
                status === t.value ? 'text-primary' : 'text-muted-foreground/70'
              )}
            >
              {tabCount(t.value) ?? '·'}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="min-w-[240px] max-w-sm flex-1">
          <SearchInput
            value={q}
            onChange={(v) => {
              setQ(v);
              setPage(1);
            }}
            placeholder="Search by title, creator or venue"
            maxLength={100}
          />
        </div>
        <EventFilters filters={filters} onChange={updateFilters} resultCount={total} />
        <div className="flex-1" />
        <span className="text-sm text-muted-foreground tabular-nums">
          {listQuery.isLoading ? 'Loading…' : `${total} ${total === 1 ? 'event' : 'events'}`}
        </span>
      </div>

      {activeFilterCount > 0 && <EventFilterChips filters={filters} onChange={updateFilters} />}

      {createdBy && (
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
          <span className="font-medium text-primary">
            Showing events by {creatorName ?? 'one creator'} — opened from Users.
          </span>
          <Link
            to="/events/moderation"
            search={{}}
            className="text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            Clear
          </Link>
        </div>
      )}

      <TooltipProvider delay={150}>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortButton
                    label="Event"
                    active={sortBy === 'title'}
                    dir={sortDir}
                    onClick={() => handleSort('title')}
                  />
                </TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Creator</TableHead>
                <TableHead>
                  <SortButton
                    label="Submitted"
                    active={sortBy === 'createdAt'}
                    dir={sortDir}
                    onClick={() => handleSort('createdAt')}
                  />
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listQuery.isError ? (
                <TableRow>
                  <TableCell colSpan={COL_COUNT} className="py-10">
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/15 px-4 py-5 text-center">
                      <p className="text-sm text-destructive">
                        Couldn&rsquo;t load events. Check your connection and try again.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => listQuery.refetch()}
                        disabled={listQuery.isFetching}
                      >
                        {listQuery.isFetching ? 'Retrying…' : 'Try again'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : listQuery.isLoading ? (
                Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                  <TableRow key={`skel-${i}`}>
                    {Array.from({ length: COL_COUNT }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : events.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={COL_COUNT}
                    className="py-10 text-center text-muted-foreground"
                  >
                    {isFiltered
                      ? 'No events match these filters. Try clearing one.'
                      : `No ${status === 'active' ? 'live' : status} events.`}
                  </TableCell>
                </TableRow>
              ) : (
                events.map((ev) => (
                  <TableRow
                    key={ev.id}
                    onClick={() => setDetailTarget(ev)}
                    className="cursor-pointer"
                  >
                    <TableCell className="max-w-[22rem]">
                      <div className="flex items-center gap-3">
                        {ev.coverImage ? (
                          <img
                            src={ev.coverImage}
                            alt=""
                            loading="lazy"
                            className="size-11 shrink-0 rounded-lg object-cover shadow-sm ring-1 ring-zinc-200"
                          />
                        ) : (
                          <div
                            className="grid size-11 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-zinc-100 to-zinc-200 text-zinc-400 shadow-sm ring-1 ring-zinc-200"
                            aria-hidden
                          >
                            <ImageOff size={16} />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{ev.title}</div>
                          <div className="truncate text-[12.5px] text-muted-foreground">
                            {ev.description}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {ev.category ? (
                        <span className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          {ev.category}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[10rem] truncate font-medium">
                        {ev.creator.name ?? 'Unknown'}
                      </div>
                      <div className="text-xs capitalize text-muted-foreground">
                        {ev.creator.persona ?? '—'}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger render={<span />}>
                          {relativeTime(ev.createdAt)}
                        </TooltipTrigger>
                        <TooltipContent>{formatDateTime(ev.createdAt)}</TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={ev.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {ev.status === 'active' ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRemoveTarget(ev);
                            }}
                            disabled={
                              removeMutation.isPending && removeMutation.variables?.id === ev.id
                            }
                          >
                            Remove
                          </Button>
                        ) : ev.status === 'removed' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRestoreTarget(ev);
                            }}
                            disabled={
                              restoreMutation.isPending && restoreMutation.variables?.id === ev.id
                            }
                          >
                            Restore
                          </Button>
                        ) : null}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailTarget(ev);
                          }}
                          aria-label={`Review ${ev.title}`}
                          className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </TooltipProvider>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span className="tabular-nums">
          {total === 0
            ? 'No events'
            : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}`}
          {activeFilterCount > 0 && ` · ${activeFilterCount} filters active`}
          {listQuery.isFetching && !listQuery.isLoading ? ' · updating…' : ''}
        </span>
        {totalPages > 1 && (
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded border border-border px-3 py-1 transition-colors hover:bg-muted disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded border border-border px-3 py-1 transition-colors hover:bg-muted disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>

      <EventDetailSheet
        event={detailTarget}
        onClose={() => setDetailTarget(null)}
        onRemove={(ev) => setRemoveTarget(ev)}
        onRestore={(ev) => setRestoreTarget(ev)}
        removePending={removeMutation.isPending}
        restorePending={restoreMutation.isPending}
      />

      <RemoveReasonDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        onConfirm={handleConfirmRemove}
      />

      <ConfirmDialog
        open={restoreTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRestoreTarget(null);
        }}
        title="Restore this event?"
        description={`“${restoreTarget?.title ?? ''}” goes live on the map again immediately. The creator is not notified.`}
        confirmLabel="Restore to live"
        onConfirm={() => {
          if (restoreTarget) handleRestore(restoreTarget.id);
        }}
      />
    </div>
  );
}

function SortButton({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <button
      className="flex items-center gap-1 transition-colors hover:text-foreground"
      onClick={onClick}
    >
      {label}
      {active ? (
        dir === 'asc' ? (
          <ChevronUp size={14} />
        ) : (
          <ChevronDown size={14} />
        )
      ) : (
        <ChevronsUpDown size={14} className="opacity-40" />
      )}
    </button>
  );
}
