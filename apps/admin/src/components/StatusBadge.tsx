import type { EventStatus } from '@CeolX/shared/enums';
import { Badge } from '@CeolX/ui/components/badge';
import { cn } from '@CeolX/ui/lib/utils';

const STATUS_LABEL: Record<EventStatus, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  rejected: 'Rejected',
  active: 'Live',
  archived: 'Archived',
  removed: 'Removed',
};

const STATUS_CLASS: Record<EventStatus, string> = {
  draft: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  pending_review: 'bg-amber-50 text-amber-800 border-amber-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  archived: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  removed: 'bg-red-50 text-red-700 border-red-200',
};

const STATUS_DOT: Record<EventStatus, string> = {
  draft: 'bg-zinc-400',
  pending_review: 'bg-amber-500',
  rejected: 'bg-red-500',
  active: 'bg-emerald-500',
  archived: 'bg-zinc-400',
  removed: 'bg-red-500',
};

const ACTIVE_PULSE =
  'before:absolute before:inset-0 before:rounded-full before:bg-emerald-500 before:opacity-75 before:animate-ping';

interface StatusBadgeProps {
  status: EventStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1.5 px-2.5 py-1 text-[11px] font-semibold tracking-wide',
        STATUS_CLASS[status]
      )}
    >
      <span className="relative inline-flex h-1.5 w-1.5">
        {status === 'active' && <span className={ACTIVE_PULSE} aria-hidden />}
        <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', STATUS_DOT[status])} />
      </span>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
