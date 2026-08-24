import type { inferRouterOutputs } from '@trpc/server';
import {
  Bookmark,
  CalendarDays,
  ChevronDown,
  ExternalLink,
  MapPin,
  RotateCcw,
  Tag,
  Trash2,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';

import type { AppRouter } from '@CeolX/api/routers/index';
import { formatTicketPrice } from '@CeolX/shared';
import { Badge } from '@CeolX/ui/components/badge';
import { Button } from '@CeolX/ui/components/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@CeolX/ui/components/sheet';

import { StatusBadge } from '@/components/StatusBadge';
import { formatDateTime, relativeTime } from '@/lib/format';

export type ListedEvent = inferRouterOutputs<AppRouter>['admin']['listEvents']['events'][number];

function Card({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="border-b border-border/60 py-4 last:border-b-0">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid size-6 place-items-center rounded-md bg-primary/10 text-primary">
          {icon}
        </span>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function KV({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-0.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{k}</span>
      <span className="text-right font-medium break-words">{children ?? '—'}</span>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  sub,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="border-r border-border/60 py-3.5 text-center last:border-r-0">
      <div className="flex items-center justify-center gap-1.5 text-lg font-bold leading-none tabular-nums">
        <span className="text-muted-foreground">{icon}</span>
        {value.toLocaleString()}
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">{label}</div>
      {sub && <div className="mt-0.5 text-[10px] text-muted-foreground/70">{sub}</div>}
    </div>
  );
}

function formatWhen(start: string | Date, end: string | Date | null): string {
  if (!end) return formatDateTime(start);
  // Same calendar day → show the date once with a time range feel via full datetimes.
  return `${formatDateTime(start)} → ${formatDateTime(end)}`;
}

export function EventDetailSheet({
  event,
  onClose,
  onRemove,
  onRestore,
  removePending,
  restorePending,
}: {
  event: ListedEvent | null;
  onClose: () => void;
  onRemove: (event: ListedEvent) => void;
  onRestore: (event: ListedEvent) => void;
  removePending: boolean;
  restorePending: boolean;
}) {
  return (
    <Sheet open={!!event} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="p-0">
        {event && (
          <DetailBody event={event} {...{ onRemove, onRestore, removePending, restorePending }} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailBody({
  event,
  onRemove,
  onRestore,
  removePending,
  restorePending,
}: {
  event: ListedEvent;
  onRemove: (event: ListedEvent) => void;
  onRestore: (event: ListedEvent) => void;
  removePending: boolean;
  restorePending: boolean;
}) {
  const creatorName = event.creator.name ?? 'Unknown';

  return (
    <>
      <SheetHeader className="border-b border-border bg-gradient-to-b from-primary/5 to-transparent p-6 pb-5">
        <div className="flex gap-3.5 pr-7">
          {event.coverImage ? (
            <img
              src={event.coverImage}
              alt={`Cover for ${event.title}`}
              className="size-14 shrink-0 rounded-lg object-cover ring-1 ring-zinc-200"
            />
          ) : (
            <div
              className="grid size-14 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-zinc-100 to-zinc-200 text-zinc-400 ring-1 ring-zinc-200"
              aria-hidden
            >
              <CalendarDays size={20} />
            </div>
          )}
          <div className="min-w-0">
            <SheetTitle className="text-xl leading-tight">{event.title}</SheetTitle>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <StatusBadge status={event.status} />
              <Badge variant="outline" className="capitalize">
                {event.creator.persona ?? 'creator'}
              </Badge>
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>By {creatorName}</span>
          <span>· Submitted {relativeTime(event.createdAt)}</span>
        </div>
      </SheetHeader>

      <div className="grid grid-cols-2 border-b border-border">
        <Stat
          label="Performers"
          value={event.confirmedCount + event.invitedCount}
          icon={<Users size={15} />}
          sub={
            event.confirmedCount + event.invitedCount > 0
              ? `${event.confirmedCount} confirmed · ${event.invitedCount} invited`
              : undefined
          }
        />
        <Stat label="Saves" value={event.savedCount} icon={<Bookmark size={15} />} />
      </div>

      <div className="flex-1 overflow-y-auto px-6">
        {event.status === 'removed' && event.removalReason && (
          <Card icon={<Trash2 size={14} />} title="Removal reason">
            <p className="text-sm leading-relaxed text-destructive">{event.removalReason}</p>
          </Card>
        )}

        <Card icon={<Tag size={14} />} title="Event details">
          <KV k="Category">{event.category ?? '—'}</KV>
          <KV k="When">{formatWhen(event.dateStart, event.dateEnd)}</KV>
          <KV k="Location">
            {event.venueAddress ?? (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${event.lat},${event.lng}`}
                target="_blank"
                rel="noreferrer"
                aria-label="View location on map (opens in a new tab)"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <MapPin size={12} /> View on map
                <ExternalLink size={11} className="opacity-60" />
              </a>
            )}
          </KV>
          <KV k="Ticket price">{formatTicketPrice(event.ticketPrice, event.ticketCurrency, 2)}</KV>
          {event.ticketLink && (
            <KV k="Ticket link">
              <a
                href={event.ticketLink}
                target="_blank"
                rel="noreferrer"
                aria-label="Open ticket link (opens in a new tab)"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Open <ExternalLink size={12} />
              </a>
            </KV>
          )}
        </Card>

        <Card icon={<CalendarDays size={14} />} title="Description">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {event.description}
          </p>
        </Card>

        <details className="border-t border-border/60 py-4">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-muted-foreground [&::-webkit-details-marker]:hidden">
            <ChevronDown size={15} />
            Details &amp; technical
          </summary>
          <div className="mt-3 space-y-1">
            <KV k="Event ID">
              <span className="font-mono text-xs text-muted-foreground">{event.id}</span>
            </KV>
            <KV k="Coordinates">
              <span className="font-mono text-xs">
                {event.lat}, {event.lng}
              </span>
            </KV>
            <KV k="Registered venue">
              {event.venueId ? (
                <span className="font-mono text-xs text-muted-foreground">{event.venueId}</span>
              ) : (
                'Free-text address'
              )}
            </KV>
            <KV k="Submitted">{formatDateTime(event.createdAt)}</KV>
            <KV k="Last updated">{formatDateTime(event.updatedAt)}</KV>
          </div>
        </details>
      </div>

      {(event.status === 'active' || event.status === 'removed') && (
        <div className="flex items-center gap-2 border-t border-border bg-card p-4">
          {event.status === 'active' ? (
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => onRemove(event)}
              disabled={removePending}
            >
              <Trash2 size={16} />
              Remove event
            </Button>
          ) : (
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onRestore(event)}
              disabled={restorePending}
            >
              <RotateCcw size={16} />
              {restorePending ? 'Restoring…' : 'Restore to live'}
            </Button>
          )}
        </div>
      )}
    </>
  );
}
