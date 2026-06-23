import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@CeolX/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@CeolX/ui/components/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@CeolX/ui/components/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@CeolX/ui/components/table';

import { PageHeader } from '../../../components/PageHeader';
import { RemoveReasonDialog } from '../../../components/RemoveReasonDialog';
import { SearchInput } from '../../../components/SearchInput';
import { StatusBadge } from '../../../components/StatusBadge';
import { formatDateTime } from '../../../lib/format';
import { queryClient, trpc } from '../../../utils/trpc';

export const Route = createFileRoute('/_admin/events/moderation')({
  // `createdBy` arrives from a user's detail sheet ("View all N events").
  validateSearch: (search: Record<string, unknown>): { createdBy?: string } => ({
    createdBy: typeof search.createdBy === 'string' ? search.createdBy : undefined,
  }),
  component: EventModerationPage,
});

type StatusFilter = 'active' | 'removed' | 'archived';
type PersonaFilter = 'all' | 'artist' | 'venue';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'active', label: 'Active (live)' },
  { value: 'removed', label: 'Removed' },
  { value: 'archived', label: 'Archived' },
];

const PERSONA_OPTIONS: { value: PersonaFilter; label: string }[] = [
  { value: 'all', label: 'All creators' },
  { value: 'artist', label: 'Artists' },
  { value: 'venue', label: 'Venues' },
];

type ListedEvent = {
  id: string;
  title: string;
  coverImage: string | null;
  description: string;
  dateStart: string | Date;
  lat: string;
  lng: string;
  venueAddress: string | null;
  category: string | null;
  status: 'active' | 'removed' | 'archived' | 'draft' | 'pending_review' | 'rejected';
  removalReason: string | null;
  createdAt: string | Date;
  creator: { id: string; name: string | null; persona: string | null };
};

function EventModerationPage() {
  const [status, setStatus] = useState<StatusFilter>('active');
  const [persona, setPersona] = useState<PersonaFilter>('all');
  const [q, setQ] = useState('');
  const [removeTarget, setRemoveTarget] = useState<ListedEvent | null>(null);
  const [detailTarget, setDetailTarget] = useState<ListedEvent | null>(null);
  const { createdBy } = Route.useSearch();

  const listQuery = useQuery(
    trpc.admin.listEvents.queryOptions({
      status,
      persona: persona === 'all' ? undefined : persona,
      q: q || undefined,
      createdBy,
      limit: 50,
      offset: 0,
    })
  );

  const removeMutation = useMutation(
    trpc.admin.removeEvent.mutationOptions({
      onSuccess: () => {
        toast.success('Event removed. The creator has been notified.');
        void queryClient.invalidateQueries(trpc.admin.listEvents.queryFilter());
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  const restoreMutation = useMutation(
    trpc.admin.restoreEvent.mutationOptions({
      onSuccess: () => {
        toast.success('Event restored. It is live on the map again.');
        void queryClient.invalidateQueries(trpc.admin.listEvents.queryFilter());
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  function handleConfirmRemove(reason: string) {
    if (!removeTarget) return;
    removeMutation.mutate({ id: removeTarget.id, removalReason: reason });
    setRemoveTarget(null);
  }

  function handleRestore(eventId: string) {
    restoreMutation.mutate({ id: eventId });
  }

  const events = (listQuery.data?.events ?? []) as ListedEvent[];
  const total = listQuery.data?.total ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Event Moderation"
        subtitle="Review live events. Remove content that violates platform policies. The creator can edit and resubmit."
      />

      <div className="flex flex-wrap items-center gap-3 pr-2">
        <div className="flex-1 min-w-56 max-w-sm">
          <SearchInput value={q} onChange={setQ} placeholder="Search events by title…" />
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Status</span>
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger className="w-48">
              {STATUS_OPTIONS.find((o) => o.value === status)?.label}
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Creator</span>
          <Select value={persona} onValueChange={(v) => setPersona(v as PersonaFilter)}>
            <SelectTrigger className="w-48">
              {PERSONA_OPTIONS.find((o) => o.value === persona)?.label}
            </SelectTrigger>
            <SelectContent>
              {PERSONA_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <span className="text-sm text-muted-foreground ml-auto">
          {listQuery.isLoading ? 'Loading…' : `${total} ${total === 1 ? 'event' : 'events'}`}
        </span>
      </div>

      {createdBy && (
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
          <span className="font-medium text-primary">
            Showing events by one creator (opened from Users).
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

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cover</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Creator</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQuery.isError ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-destructive py-8">
                  Failed to load events. {listQuery.error.message}
                </TableCell>
              </TableRow>
            ) : events.length === 0 && !listQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No events match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              events.map((ev) => (
                <TableRow
                  key={ev.id}
                  className="cursor-pointer"
                  onClick={() => setDetailTarget(ev)}
                >
                  <TableCell>
                    {ev.coverImage ? (
                      <img
                        src={ev.coverImage}
                        alt=""
                        className="h-11 w-11 rounded-lg object-cover ring-1 ring-zinc-200 shadow-sm"
                      />
                    ) : (
                      <div
                        className="h-11 w-11 rounded-lg bg-linear-to-br from-zinc-100 to-zinc-200 ring-1 ring-zinc-200 flex items-center justify-center text-zinc-400 shadow-sm"
                        aria-hidden
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4"
                        >
                          <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                          <circle cx="9" cy="9" r="2" />
                          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                        </svg>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{ev.title}</TableCell>
                  <TableCell className="capitalize">
                    {ev.category ? ev.category.replace(/_/g, ' ') : '-'}
                  </TableCell>
                  <TableCell>
                    <div>{ev.creator.name ?? 'Unknown'}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {ev.creator.persona ?? '-'}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(ev.dateStart)}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate">
                    {ev.venueAddress ?? `${ev.lat}, ${ev.lng}`}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={ev.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    {ev.status === 'active' ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRemoveTarget(ev);
                        }}
                        disabled={removeMutation.isPending}
                      >
                        Remove
                      </Button>
                    ) : ev.status === 'removed' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRestore(ev.id);
                        }}
                        disabled={restoreMutation.isPending}
                      >
                        Restore
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground/70">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <RemoveReasonDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        onConfirm={handleConfirmRemove}
      />

      <Dialog
        open={detailTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDetailTarget(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailTarget && (
            <div className="space-y-6">
              <DialogHeader className="space-y-2">
                <DialogTitle>{detailTarget.title}</DialogTitle>
                <DialogDescription>
                  Created by {detailTarget.creator.name ?? 'Unknown'} (
                  <span className="capitalize">{detailTarget.creator.persona ?? '-'}</span>) on{' '}
                  {formatDateTime(detailTarget.createdAt)}
                </DialogDescription>
              </DialogHeader>
              {detailTarget.coverImage && (
                <img
                  src={detailTarget.coverImage}
                  alt=""
                  className="w-full max-h-64 rounded-md object-cover"
                />
              )}
              <dl className="grid grid-cols-2 gap-x-6 gap-y-5 text-sm">
                <div className="flex flex-col gap-1.5">
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Status
                  </dt>
                  <dd>
                    <StatusBadge status={detailTarget.status} />
                  </dd>
                </div>
                <div className="flex flex-col gap-1.5">
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Event date
                  </dt>
                  <dd className="text-foreground">{formatDateTime(detailTarget.dateStart)}</dd>
                </div>
                <div className="col-span-2 flex flex-col gap-1.5">
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Location
                  </dt>
                  <dd className="text-foreground">
                    {detailTarget.venueAddress ?? '-'} ({detailTarget.lat}, {detailTarget.lng})
                  </dd>
                </div>
                <div className="col-span-2 flex flex-col gap-1.5">
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Description
                  </dt>
                  <dd className="text-foreground whitespace-pre-wrap leading-relaxed">
                    {detailTarget.description}
                  </dd>
                </div>
                {detailTarget.removalReason && (
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Removal reason
                    </dt>
                    <dd className="text-destructive">{detailTarget.removalReason}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
