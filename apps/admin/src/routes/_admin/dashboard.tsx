import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarCheck,
  CalendarDays,
  CreditCard,
  Info,
  Music2,
  UserPlus,
  UsersRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { Card } from '@CeolX/ui/components/card';
import { Skeleton } from '@CeolX/ui/components/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@CeolX/ui/components/tooltip';

import { trpc } from '@/utils/trpc';

export const Route = createFileRoute('/_admin/dashboard')({
  component: DashboardPage,
});

// Server caches stats for 5 minutes (admin/stats.ts CACHE_TTL_MS). Refetching
// faster is wasted work — the server returns the same cached snapshot. Aligning
// to the TTL keeps on-screen data ≤5 min fresh while the dashboard sits open.
const STATS_REFETCH_INTERVAL_MS = 5 * 60 * 1000;
// "Updated X ago" is derived from data at render time, so it freezes between
// refetches. Re-render on a short interval so the relative age stays truthful.
const RELATIVE_AGE_TICK_MS = 30 * 1000;

type Trend = 'up' | 'down' | 'flat';
type AttentionTone = 'warning' | 'destructive';
type StatTone = 'neutral' | 'warning' | 'destructive';

// Restrained, semantic palette. Color appears only where it communicates state.
const COLOR = {
  warning: '#b45309', // amber-700
  warningBg: 'rgba(180, 83, 9, 0.08)',
  destructive: '#b91c1c', // red-700
  destructiveBg: 'rgba(185, 28, 28, 0.07)',
  success: '#059669', // emerald-600 — only used in the trend pill
  successBg: 'rgba(5, 150, 105, 0.08)',
  brand: '#6366f1', // indigo-500 — only used for the top-category #1 rank
  brandBg: 'rgba(99, 102, 241, 0.10)',
  neutralBg: 'rgba(0, 0, 0, 0.035)',
  neutralDot: 'rgba(0, 0, 0, 0.30)',
  iconChipBg: 'rgba(0, 0, 0, 0.045)',
  iconColor: 'rgba(0, 0, 0, 0.55)',
};

function formatCacheAge(cachedAt: string): string {
  const ageMs = Date.now() - new Date(cachedAt).getTime();
  const ageSec = Math.max(0, Math.round(ageMs / 1000));
  if (ageSec < 60) return `${ageSec}s ago`;
  return `${Math.round(ageSec / 60)}m ago`;
}

function toNumber(value: number | string): number {
  if (typeof value === 'number') return value;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function TrendPill({ trend, label }: { trend: Trend; label: string }) {
  const isUp = trend === 'up';
  const isDown = trend === 'down';
  const color = isUp ? COLOR.success : isDown ? COLOR.destructive : COLOR.neutralDot;
  const bg = isUp ? COLOR.successBg : isDown ? COLOR.destructiveBg : COLOR.neutralBg;
  const Icon = isUp ? ArrowUp : isDown ? ArrowDown : ArrowRight;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold"
      style={{ color, backgroundColor: bg }}
    >
      <Icon size={11} strokeWidth={2.5} />
      <span>{label}</span>
    </span>
  );
}

function AttentionPill({ label, tone }: { label: string; tone: AttentionTone }) {
  const color = tone === 'destructive' ? COLOR.destructive : COLOR.warning;
  const bg = tone === 'destructive' ? COLOR.destructiveBg : COLOR.warningBg;
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{ color, backgroundColor: bg }}
    >
      {label}
    </span>
  );
}

function IconChip({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
      style={{ backgroundColor: COLOR.iconChipBg }}
    >
      <Icon size={15} strokeWidth={2} style={{ color: COLOR.iconColor }} />
    </span>
  );
}

function StatTile({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number | string;
  tone?: StatTone;
}) {
  // Color appears only when there is a real state to communicate.
  const numeric = toNumber(value);
  const highlight = tone !== 'neutral' && numeric > 0;
  const color = tone === 'destructive' ? COLOR.destructive : COLOR.warning;
  const bg = tone === 'destructive' ? COLOR.destructiveBg : COLOR.warningBg;

  return (
    <div
      className="flex flex-col gap-1 rounded-lg px-3 py-2.5"
      style={{ backgroundColor: highlight ? bg : COLOR.neutralBg }}
    >
      <div className="flex items-center gap-1.5">
        {highlight && (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        )}
        <span
          className="text-[15px] font-bold leading-none tabular-nums"
          style={highlight ? { color } : undefined}
        >
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
      </div>
      <span className="text-[11px] leading-tight text-muted-foreground">{label}</span>
    </div>
  );
}

// Small "?" affordance for metrics whose meaning isn't obvious from the label.
// Use sparingly — only where the label genuinely leaves room for misreading.
function InfoHint({ text }: { text: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              className="inline-flex items-center text-muted-foreground/50 transition-colors hover:text-foreground focus:outline-none focus-visible:text-foreground"
              aria-label="What does this mean?"
            />
          }
        >
          <Info size={13} strokeWidth={2} />
        </TooltipTrigger>
        <TooltipContent>{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface MetricCardProps {
  label: string;
  icon: LucideIcon;
  value: ReactNode;
  caption?: ReactNode;
  attention?: { label: string; tone: AttentionTone };
  info?: string;
  children?: ReactNode;
}

function MetricCard({ label, icon, value, caption, attention, info, children }: MetricCardProps) {
  return (
    <Card className="h-full gap-0 py-0 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-shadow duration-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
      <div className="flex h-full flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <IconChip icon={icon} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              {label}
            </span>
            {info && <InfoHint text={info} />}
          </div>
          {attention && <AttentionPill label={attention.label} tone={attention.tone} />}
        </div>

        <div className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <div className="text-[30px] font-bold leading-none tabular-nums text-foreground">
            {value}
          </div>
          {caption}
        </div>

        {children && <div className="mt-5 flex-1">{children}</div>}
      </div>
    </Card>
  );
}

function StatGrid({ cols = 2, children }: { cols?: 2 | 3; children: ReactNode }) {
  return (
    <div className={`grid gap-2 ${cols === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>{children}</div>
  );
}

function KpiSkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 9 }).map((_, i) => (
        <Skeleton key={i} className="h-52 rounded-lg" />
      ))}
    </div>
  );
}

function DashboardPage() {
  const { data, isLoading, error } = useQuery(
    trpc.admin.stats.queryOptions(undefined, {
      refetchInterval: STATS_REFETCH_INTERVAL_MS,
    })
  );

  // Force a re-render on a timer so "Updated X ago" advances even when no
  // refetch has occurred (e.g. tab left open and focused).
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), RELATIVE_AGE_TICK_MS);
    return () => clearInterval(id);
  }, []);

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
        <div className="rounded-lg border border-destructive/30 bg-destructive/15 p-4 text-sm text-destructive">
          Could not load dashboard data. Try refreshing.
        </div>
      </div>
    );
  }

  const { users, events, subscriptions, bookings, topCategories, categoriesInUse, sessions } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between pr-2">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:text-foreground"
                  aria-label="About this timestamp"
                />
              }
            >
              Updated {formatCacheAge(data.cachedAt)}
              <Info size={12} strokeWidth={2} className="opacity-70" />
            </TooltipTrigger>
            <TooltipContent>
              The dashboard statistics refresh automatically every 5 minutes, so they stay up to
              date. This time shows when they were last refreshed.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label="Total Users"
          icon={UsersRound}
          value={users.total.toLocaleString()}
          caption={<span className="text-xs text-muted-foreground">across all personas</span>}
        >
          <StatGrid cols={3}>
            <StatTile label="Spectators" value={users.byPersona.spectator} />
            <StatTile label="Artists" value={users.byPersona.artist} />
            <StatTile label="Venues" value={users.byPersona.venue} />
          </StatGrid>
        </MetricCard>

        <MetricCard
          label="Active Users"
          icon={Activity}
          info="Counts people who signed in during the period. Anyone active in the last 7 days is also counted in the last 30, so the 30-day number is always equal to or higher."
          value={sessions.activeLast30Days.toLocaleString()}
          caption={<span className="text-xs text-muted-foreground">in last 30 days</span>}
        >
          <StatGrid cols={2}>
            <StatTile label="Last 7 days" value={sessions.activeLast7Days} />
            <StatTile label="Last 30 days" value={sessions.activeLast30Days} />
          </StatGrid>
        </MetricCard>

        <MetricCard
          label="New Users"
          icon={UserPlus}
          value={users.newLast30Days.toLocaleString()}
          caption={<TrendPill trend={users.trend30d} label="vs. last month" />}
        >
          <StatGrid cols={2}>
            <StatTile label="This week" value={users.newLast7Days} />
            <StatTile label="Previous week" value={users.newPrev7Days} />
          </StatGrid>
        </MetricCard>

        <MetricCard
          label="Monthly Revenue"
          icon={CreditCard}
          attention={
            subscriptions.pastDueCount > 0 ? { label: 'Past due', tone: 'destructive' } : undefined
          }
          value={
            <span>
              <span className="text-xl font-semibold text-muted-foreground/70">€</span>
              {subscriptions.mrr.toLocaleString()}
            </span>
          }
          caption={
            <TrendPill
              trend={subscriptions.trend30d}
              label={`+${subscriptions.newLast30Days} in 30d`}
            />
          }
        >
          <StatGrid cols={2}>
            <StatTile label="Active subs" value={subscriptions.activeVenues} />
            <StatTile label="Past due" value={subscriptions.pastDueCount} tone="destructive" />
          </StatGrid>
        </MetricCard>

        <MetricCard
          label="Events"
          icon={CalendarDays}
          attention={
            events.byStatus.pending_review > 0
              ? { label: 'Needs review', tone: 'warning' }
              : undefined
          }
          value={events.total.toLocaleString()}
          caption={<span className="text-xs text-muted-foreground">total events</span>}
        >
          <StatGrid cols={2}>
            <StatTile label="Active" value={events.byStatus.active} />
            <StatTile label="Pending" value={events.byStatus.pending_review} tone="warning" />
            <StatTile label="Removed" value={events.byStatus.removed} tone="destructive" />
            <StatTile label="Archived" value={events.byStatus.archived} />
          </StatGrid>
        </MetricCard>

        <MetricCard
          label="Top Categories"
          icon={Music2}
          info="Your most-used event categories, ranked by how many events use each. Counts cover published events only. Drafts are not included."
          value={categoriesInUse.toLocaleString()}
          caption={
            <span className="text-xs text-muted-foreground">
              {categoriesInUse === 1 ? 'category in use' : 'categories in use'}
            </span>
          }
        >
          {topCategories.length === 0 ? (
            <div
              className="rounded-lg py-3 text-center text-xs text-muted-foreground"
              style={{ backgroundColor: COLOR.neutralBg }}
            >
              No events yet
            </div>
          ) : (
            <div className="space-y-1.5">
              {topCategories.slice(0, 3).map((tc) => (
                <div
                  key={tc.category}
                  className="flex items-center justify-between gap-2 rounded-lg px-3 py-2"
                  style={{ backgroundColor: COLOR.neutralBg }}
                >
                  <span className="truncate text-xs font-medium">{tc.category}</span>
                  <span className="shrink-0 text-xs tabular-nums">
                    <span className="font-bold">{tc.count.toLocaleString()}</span>
                    <span className="ml-1 font-normal text-muted-foreground">
                      {tc.count === 1 ? 'event' : 'events'}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </MetricCard>

        <MetricCard
          label="Bookings"
          icon={CalendarCheck}
          attention={
            bookings.byStatus.pending > 0 ? { label: 'Pending', tone: 'warning' } : undefined
          }
          value={bookings.total.toLocaleString()}
          caption={<span className="text-xs text-muted-foreground">total bookings</span>}
        >
          <StatGrid cols={2}>
            <StatTile label="Accepted" value={bookings.byStatus.accepted} />
            <StatTile label="Pending" value={bookings.byStatus.pending} tone="warning" />
            <StatTile label="Rejected" value={bookings.byStatus.rejected} tone="destructive" />
            <StatTile label="Cancelled" value={bookings.byStatus.cancelled} />
          </StatGrid>
        </MetricCard>
      </div>
    </div>
  );
}
