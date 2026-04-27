import type { EventStatus } from '@CeolX/shared/enums';
import { Badge } from '@CeolX/ui/components/badge';

const STATUS_LABEL: Record<EventStatus, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  rejected: 'Rejected',
  active: 'Live',
  archived: 'Archived',
  removed: 'Removed',
};

const STATUS_CLASS: Record<EventStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  pending_review: 'bg-warning/20 text-warning border-warning/40',
  rejected: 'bg-destructive/20 text-destructive border-destructive/40',
  active: 'bg-success/20 text-success border-success/40',
  archived: 'bg-muted text-muted-foreground',
  removed: 'bg-destructive/20 text-destructive border-destructive/40',
};

interface StatusBadgeProps {
  status: EventStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <Badge variant="outline" className={STATUS_CLASS[status]}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
