import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
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

import { PageHeader } from '../../../components/PageHeader';
import { RemoveReasonDialog } from '../../../components/RemoveReasonDialog';
import { SearchInput } from '../../../components/SearchInput';
import { StatusBadge } from '../../../components/StatusBadge';
import { queryClient, trpc } from '../../../utils/trpc';

export const Route = createFileRoute('/_admin/events/moderation')({
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
  status: 'active' | 'removed' | 'archived' | 'draft' | 'pending_review' | 'rejected';
  removalReason: string | null;
  createdAt: string | Date;
  creator: { id: string; name: string | null; persona: string | null };
};

function formatDateTime(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleString('en-IE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function EventModerationPage() {
  const [status, setStatus] = useState<StatusFilter>('active');
  const [persona, setPersona] = useState<PersonaFilter>('all');
  const [q, setQ] = useState('');
  const [removeTarget, setRemoveTarget] = useState<ListedEvent | null>(null);
  const [detailTarget, setDetailTarget] = useState<ListedEvent | null>(null);

  const listQuery = useQuery(
    trpc.admin.listEvents.queryOptions({
      status,
      persona: persona === 'all' ? undefined : persona,
      q: q || undefined,
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

  function handleConfirmRemove(reason: string) {
    if (!removeTarget) return;
    removeMutation.mutate({ id: removeTarget.id, removalReason: reason });
    setRemoveTarget(null);
  }

  const events = (listQuery.data?.events ?? []) as ListedEvent[];
  const total = listQuery.data?.total ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Event Moderation"
        subtitle="Review live events. Remove content that violates platform policies — the creator can edit and resubmit."
      />

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-gray-600">Status</span>
          <select
            className="h-9 rounded border border-gray-300 bg-white px-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-gray-600">Creator</span>
          <select
            className="h-9 rounded border border-gray-300 bg-white px-2 text-sm"
            value={persona}
            onChange={(e) => setPersona(e.target.value as PersonaFilter)}
          >
            {PERSONA_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex-1 min-w-[200px] max-w-sm">
          <SearchInput value={q} onChange={setQ} placeholder="Search events by title…" />
        </div>

        <span className="text-sm text-gray-500 ml-auto">
          {listQuery.isLoading ? 'Loading…' : `${total} ${total === 1 ? 'event' : 'events'}`}
        </span>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-600">Cover</th>
              <th className="px-4 py-3 font-medium text-gray-600">Title</th>
              <th className="px-4 py-3 font-medium text-gray-600">Creator</th>
              <th className="px-4 py-3 font-medium text-gray-600">Date</th>
              <th className="px-4 py-3 font-medium text-gray-600">Location</th>
              <th className="px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {listQuery.isError ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-red-500">
                  Failed to load events. {listQuery.error.message}
                </td>
              </tr>
            ) : events.length === 0 && !listQuery.isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No events match the current filters.
                </td>
              </tr>
            ) : (
              events.map((ev) => (
                <tr
                  key={ev.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setDetailTarget(ev)}
                >
                  <td className="px-4 py-3">
                    {ev.coverImage ? (
                      <img src={ev.coverImage} alt="" className="h-10 w-10 rounded object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded bg-gray-100" aria-hidden />
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{ev.title}</td>
                  <td className="px-4 py-3 text-gray-700">
                    <div>{ev.creator.name ?? 'Unknown'}</div>
                    <div className="text-xs text-gray-500 capitalize">
                      {ev.creator.persona ?? '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{formatDateTime(ev.dateStart)}</td>
                  <td className="px-4 py-3 text-gray-700 max-w-xs truncate">
                    {ev.venueAddress ?? `${ev.lat}, ${ev.lng}`}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={ev.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
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
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
        <DialogContent className="max-w-2xl">
          {detailTarget && (
            <>
              <DialogHeader>
                <DialogTitle>{detailTarget.title}</DialogTitle>
                <DialogDescription>
                  Created by {detailTarget.creator.name ?? 'Unknown'} (
                  <span className="capitalize">{detailTarget.creator.persona ?? '—'}</span>) on{' '}
                  {formatDateTime(detailTarget.createdAt)}
                </DialogDescription>
              </DialogHeader>
              {detailTarget.coverImage && (
                <img
                  src={detailTarget.coverImage}
                  alt=""
                  className="w-full max-h-64 rounded object-cover"
                />
              )}
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-gray-500">Status</dt>
                  <dd>
                    <StatusBadge status={detailTarget.status} />
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Event date</dt>
                  <dd className="text-gray-900">{formatDateTime(detailTarget.dateStart)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-gray-500">Location</dt>
                  <dd className="text-gray-900">
                    {detailTarget.venueAddress ?? '—'} ({detailTarget.lat}, {detailTarget.lng})
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-gray-500">Description</dt>
                  <dd className="text-gray-900 whitespace-pre-wrap">{detailTarget.description}</dd>
                </div>
                {detailTarget.removalReason && (
                  <div className="col-span-2">
                    <dt className="text-gray-500">Removal reason</dt>
                    <dd className="text-red-700">{detailTarget.removalReason}</dd>
                  </div>
                )}
              </dl>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
