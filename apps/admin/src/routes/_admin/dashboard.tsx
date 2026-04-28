import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react';
import type { ReactNode } from 'react';

import { Skeleton } from '@CeolX/ui/components/skeleton';

import { KpiCard } from '@/components/KpiCard';
import { trpc } from '@/utils/trpc';

export const Route = createFileRoute('/_admin/dashboard')({
  component: DashboardPage,
});

type Trend = 'up' | 'down' | 'flat';

function TrendIcon({ trend }: { trend: Trend }) {
  if (trend === 'up') return <ArrowUp size={14} className="text-emerald-600" />;
  if (trend === 'down') return <ArrowDown size={14} className="text-red-600" />;
  return <ArrowRight size={14} className="text-muted-foreground" />;
}

function TrendLine({ trend, label }: { trend: Trend; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <TrendIcon trend={trend} />
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

function KpiSkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-32 rounded-lg" />
      ))}
    </div>
  );
}

function KpiBreakdown({ items }: { items: Array<{ label: string; value: number }> }) {
  return (
    <div className="space-y-1.5 mt-2">
      {items.map((it) => (
        <div key={it.label} className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{it.label}</span>
          <span className="font-medium">{it.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

function DashboardPage() {
  const { data, isLoading, error } = useQuery(trpc.admin.stats.queryOptions());

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <KpiSkeletonGrid />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Could not load dashboard data. Try refreshing.
        </div>
      </div>
    );
  }

  const { users, events, subscriptions, engagement, pendingModeration } = data;

  const cards: Array<{ label: string; value: ReactNode; trend?: ReactNode }> = [
    // 6 cards per spec: total users, users by persona, events by status,
    // subscriptions/MRR, engagement, pending moderation.
    {
      label: 'Total Users',
      value: users.total.toLocaleString(),
      trend: (
        <div className="flex items-center justify-between">
          <TrendLine trend={users.trend} label={`${users.newLast30Days} new in 30 days`} />
          <span className="text-xs text-muted-foreground">{users.newLast7Days} this week</span>
        </div>
      ),
    },
    {
      label: 'Users by Persona',
      value: <span className="text-2xl">{users.total.toLocaleString()}</span>,
      trend: (
        <KpiBreakdown
          items={[
            { label: 'Spectators', value: users.byPersona.spectator },
            { label: 'Artists', value: users.byPersona.artist },
            { label: 'Venues', value: users.byPersona.venue },
          ]}
        />
      ),
    },
    {
      label: 'Events by Status',
      value: events.total.toLocaleString(),
      trend: (
        <KpiBreakdown
          items={[
            { label: 'Active', value: events.byStatus.active },
            { label: 'Pending', value: events.byStatus.pending_review },
            { label: 'Removed', value: events.byStatus.removed },
            { label: 'Archived', value: events.byStatus.archived },
          ]}
        />
      ),
    },
    {
      label: 'Active Subscriptions',
      value: subscriptions.activeVenues.toLocaleString(),
      trend: (
        <div className="space-y-1.5 mt-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">MRR</span>
            <span className="font-medium">€{subscriptions.mrr.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Past due</span>
            <span className="font-medium">{subscriptions.pastDueCount}</span>
          </div>
          <TrendLine
            trend={subscriptions.trend}
            label={`${subscriptions.newLast30Days} new in 30 days`}
          />
        </div>
      ),
    },
    {
      label: 'Engagement',
      value: (engagement.totalFollows + engagement.totalBookings).toLocaleString(),
      trend: (
        <KpiBreakdown
          items={[
            { label: 'Follows', value: engagement.totalFollows },
            { label: 'Bookings', value: engagement.totalBookings },
            { label: 'Posts', value: engagement.totalPosts },
          ]}
        />
      ),
    },
    {
      label: 'Pending Moderation',
      value: pendingModeration.toLocaleString(),
      trend: (
        <p className="text-xs text-muted-foreground mt-2">
          {pendingModeration === 0
            ? 'No events awaiting review.'
            : `${pendingModeration} event${pendingModeration === 1 ? '' : 's'} awaiting review.`}
        </p>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <KpiCard key={c.label} label={c.label} value={c.value} trend={c.trend} />
        ))}
      </div>
    </div>
  );
}
