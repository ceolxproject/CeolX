import { useMutation } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@CeolX/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@CeolX/ui/components/card';

import { PageHeader } from '../../components/PageHeader';
import { trpc } from '../../utils/trpc';

export const Route = createFileRoute('/_admin/maintenance')({
  component: MaintenancePage,
});

function MaintenancePage() {
  const resyncMutation = useMutation(
    trpc.admin.resyncEvents.mutationOptions({
      onSuccess: ({ synced }) => {
        toast.success(
          synced === 0
            ? 'Search index is ready. No active upcoming events to index.'
            : `Search index re-synced — ${synced} ${synced === 1 ? 'event' : 'events'} indexed.`
        );
      },
      onError: (err) => {
        toast.error(`Re-sync failed: ${err.message}`);
      },
    })
  );

  const lastSynced = resyncMutation.data?.synced;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance"
        subtitle="Operational tools for keeping the platform healthy."
      />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Discovery search index</CardTitle>
          <CardDescription>
            Discovery and the Map read from the search index, not the database directly. Re-syncing
            recreates the events collection if it is missing and re-indexes all active upcoming
            events. Use this after a search-service outage or configuration change if events look
            missing on the map or feed.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Button onClick={() => resyncMutation.mutate()} disabled={resyncMutation.isPending}>
            <RefreshCw
              size={16}
              className={resyncMutation.isPending ? 'animate-spin' : undefined}
            />
            {resyncMutation.isPending ? 'Re-syncing…' : 'Re-sync events'}
          </Button>
          {resyncMutation.isSuccess && lastSynced !== undefined && (
            <span className="text-sm text-muted-foreground">
              Last run indexed {lastSynced} {lastSynced === 1 ? 'event' : 'events'}.
            </span>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
