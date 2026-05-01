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
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-32 rounded-lg" />
      ))}
    </div>
  );
}

function KpiBreakdown({ items }: { items: Array<{ label: string; value: number | string }> }) {
  return (
    <div className="space-y-1.5 mt-2">
      {items.map((it) => (
        <div key={it.label} className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{it.label}</span>
          <span className="font-medium">
            {typeof it.value === 'number' ? it.value.toLocaleString() : it.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function formatCacheAge(cachedAt: string): string {
  const ageMs = Date.now() - new Date(cachedAt).getTime();
  const ageSec = Math.max(0, Math.round(ageMs / 1000));
  if (ageSec < 60) return `${ageSec}s ago`;
  return `${Math.round(ageSec / 60)}m ago`;
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

  const {
    users,
    events,
    subscriptions,
    bookings,
    engagement,
    moderation,
    topCategories,
    sessions,
  } = data;

  const cards: Array<{ label: string; value: ReactNode; trend?: ReactNode }> = [
    {
      label: 'Total Users',
      value: users.total.toLocaleString(),
      trend: (
        <div className="space-y-1">
          <TrendLine trend={users.trend7d} label={`${users.newLast7Days} new this week`} />
          <TrendLine trend={users.trend30d} label={`${users.newLast30Days} new in 30 days`} />
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
      label: 'Active Users',
      value: sessions.activeLast30Days.toLocaleString(),
      trend: (
        <KpiBreakdown
          items={[
            { label: 'Last 7 days', value: sessions.activeLast7Days },
            { label: 'Last 30 days', value: sessions.activeLast30Days },
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
      label: 'Top Categories',
      value: topCategories[0]?.category ?? '—',
      trend:
        topCategories.length > 0 ? (
          <KpiBreakdown
            items={topCategories.map((tc) => ({ label: tc.category, value: tc.count }))}
          />
        ) : (
          <p className="text-xs text-muted-foreground mt-2">No events yet.</p>
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
            trend={subscriptions.trend30d}
            label={`${subscriptions.newLast30Days} new in 30 days`}
          />
        </div>
      ),
    },
    {
      label: 'Bookings',
      value: bookings.total.toLocaleString(),
      trend: (
        <KpiBreakdown
          items={[
            { label: 'Pending', value: bookings.byStatus.pending },
            { label: 'Accepted', value: bookings.byStatus.accepted },
            { label: 'Rejected', value: bookings.byStatus.rejected },
            { label: 'Cancelled', value: bookings.byStatus.cancelled },
          ]}
        />
      ),
    },
    {
      label: 'Engagement',
      value: (engagement.totalFollows + engagement.totalPosts).toLocaleString(),
      trend: (
        <KpiBreakdown
          items={[
            { label: 'Follows', value: engagement.totalFollows },
            { label: 'Posts', value: engagement.totalPosts },
            { label: 'Avg likes/post', value: engagement.avgLikesPerPost.toFixed(1) },
          ]}
        />
      ),
    },
    {
      label: 'Removed Events',
      value: moderation.removedLast7Days.toLocaleString(),
      trend: (
        <div className="space-y-1.5 mt-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Last 7 days</span>
            <span className="font-medium">{moderation.removedLast7Days}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Total removed</span>
            <span className="font-medium">{moderation.removedTotal}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Pending review</span>
            <span className="font-medium">{moderation.pendingReview}</span>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-xs text-muted-foreground">Updated {formatCacheAge(data.cachedAt)}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <KpiCard key={c.label} label={c.label} value={c.value} trend={c.trend} />
        ))}
      </div>
    </div>
  );
}
