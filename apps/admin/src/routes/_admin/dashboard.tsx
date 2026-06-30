import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  Handshake,
  Heart,
  Info,
  Music2,
  ShieldAlert,
  UserPlus,
  UsersRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { Popover, PopoverContent, PopoverTrigger } from '@CeolX/ui/components/popover';
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

// Trend-pill tones — color only where it communicates direction.
const TONE = {
  success: '#16a34a',
  successBg: 'rgba(22, 163, 74, 0.10)',
  destructive: '#b91c1c',
  destructiveBg: 'rgba(185, 28, 28, 0.08)',
  neutral: '#9a9aa3',
  neutralBg: 'rgba(15, 23, 42, 0.05)',
};

// Proportion-bar / legend segment colors. Neutral grey for the "rest" category,
// brand purple + a distinct teal for the personas, semantic status for events.
const SEG = {
  spectator: '#c2c2cb',
  artist: '#7c6fff',
  venue: '#22a3c4',
  active: '#16a34a',
  archived: '#c2c2cb',
  removed: '#b91c1c',
};

function formatCacheAge(cachedAt: string): string {
  const ageMs = Date.now() - new Date(cachedAt).getTime();
  const ageSec = Math.max(0, Math.round(ageMs / 1000));
  if (ageSec < 60) return `${ageSec}s ago`;
  return `${Math.round(ageSec / 60)}m ago`;
}

function TrendPill({ trend, label }: { trend: Trend; label: string }) {
  const isUp = trend === 'up';
  const isDown = trend === 'down';
  const color = isUp ? TONE.success : isDown ? TONE.destructive : TONE.neutral;
  const bg = isUp ? TONE.successBg : isDown ? TONE.destructiveBg : TONE.neutralBg;
  const Icon = isUp ? ArrowUp : isDown ? ArrowDown : ArrowRight;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-bold"
      style={{ color, backgroundColor: bg }}
    >
      <Icon size={11} strokeWidth={2.5} />
      <span>{label}</span>
    </span>
  );
}

// Small ⓘ affordance for metrics whose meaning isn't obvious from the label.
// Popover, not Tooltip: opens on click (what the ⓘ glyph implies, and touch-friendly)
// and also on hover after a short delay.
function InfoHint({ text }: { text: string }) {
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        render={
          <button
            type="button"
            className="inline-flex items-center text-muted-foreground/50 transition-colors hover:text-foreground focus:outline-none focus-visible:text-foreground"
            aria-label="What does this mean?"
          />
        }
      >
        <Info size={13} strokeWidth={2} />
      </PopoverTrigger>
      <PopoverContent className="max-w-xs rounded-md border-transparent bg-foreground px-3 py-2 text-xs leading-relaxed text-background">
        {text}
      </PopoverContent>
    </Popover>
  );
}

// ── Layout primitives ────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-[13px] font-semibold text-foreground">{title}</h2>
        <span className="h-px flex-1 bg-border" />
      </div>
      {children}
    </section>
  );
}

function Panel({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3.5 rounded-xl border border-border bg-card p-[18px] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_-4px_rgba(15,23,42,0.06)]">
      <div className="flex items-center gap-2">
        <span className="grid size-[26px] shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
          <Icon size={14} strokeWidth={2} />
        </span>
        <h3 className="text-[13.5px] font-semibold">{title}</h3>
        {hint && (
          <span className="ml-auto flex">
            <InfoHint text={hint} />
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

// A single segmented proportion bar — the one chart-like element, used only
// where a part-to-whole split is genuinely the fastest read.
function ProportionBar({ segments }: { segments: { value: number; color: string }[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
      {total > 0 &&
        segments.map((s, i) => (
          <span
            key={i}
            style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }}
          />
        ))}
    </div>
  );
}

function LegendRow({ color, name, value }: { color: string; name: string; value: number }) {
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-muted-foreground">{name}</span>
      <span className="ml-auto font-bold tabular-nums">{value.toLocaleString()}</span>
    </div>
  );
}

function MiniStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg bg-muted px-3 py-2.5">
      <div className="text-base font-extrabold leading-none tabular-nums">
        {value.toLocaleString()}
      </div>
      <div className="mt-1.5 text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-muted px-2.5 py-2 text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold tabular-nums">{value.toLocaleString()}</span>
    </div>
  );
}

function RankRow({ name, value, max }: { name: string; value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-muted px-2.5 py-2 text-[13px]">
      <span className="w-28 shrink-0 truncate font-medium">{name}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-primary/15">
        <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </span>
      <span className="w-6 shrink-0 text-right font-bold tabular-nums">
        {value.toLocaleString()}
      </span>
    </div>
  );
}

function BandCell({
  label,
  value,
  note,
  trend,
  hint,
}: {
  label: string;
  value: number;
  note: string;
  trend?: ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 bg-card px-5 py-5">
      <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        {label}
        {hint && <InfoHint text={hint} />}
      </span>
      <div className="flex items-baseline gap-2">
        <span className="text-[32px] font-extrabold leading-none tracking-[-0.02em] tabular-nums">
          {value.toLocaleString()}
        </span>
        {trend}
      </div>
      <span className="text-xs text-muted-foreground/80">{note}</span>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-[108px] w-full rounded-xl" />
      {[3, 2, 3].map((n, gi) => (
        <div key={gi} className="space-y-3">
          <Skeleton className="h-3.5 w-28" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: n }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        </div>
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
      <div className="space-y-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <DashboardSkeleton />
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

  const {
    users,
    events,
    bookings,
    engagement,
    moderation,
    topCategories,
    categoriesInUse,
    sessions,
  } = data;
  const maxCategory = topCategories[0]?.count ?? 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 pr-2">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {users.total.toLocaleString()} {users.total === 1 ? 'person' : 'people'} ·{' '}
            {events.total.toLocaleString()} {events.total === 1 ? 'event' : 'events'} across CeolX
          </p>
        </div>
        <TooltipProvider delay={150}>
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 pt-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:text-foreground"
                  aria-label="About this timestamp"
                />
              }
            >
              <span className="size-1.5 rounded-full" style={{ backgroundColor: TONE.success }} />
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

      {/* Summary band — the headline numbers that define the platform right now.
          Active users lives in the People section below, so it's not repeated here. */}
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_-4px_rgba(15,23,42,0.06)] md:grid-cols-3">
        <BandCell
          label="Users"
          value={users.total}
          note="new this month"
          trend={<TrendPill trend={users.trend30d} label={users.newLast30Days.toLocaleString()} />}
        />
        <BandCell
          label="Events"
          value={events.total}
          note="new this month"
          trend={
            <TrendPill trend={events.trend30d} label={events.newLast30Days.toLocaleString()} />
          }
        />
        <BandCell
          label="Bookings"
          value={bookings.total}
          note="invites & requests"
          hint="Performance requests between artists and venues — venue invites and artist applications. Not saved events."
        />
      </div>

      {/* People */}
      <Section title="People">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Panel icon={UsersRound} title="Users by persona">
            <ProportionBar
              segments={[
                { value: users.byPersona.spectator, color: SEG.spectator },
                { value: users.byPersona.artist, color: SEG.artist },
                { value: users.byPersona.venue, color: SEG.venue },
              ]}
            />
            <div className="flex flex-col gap-2">
              <LegendRow
                color={SEG.spectator}
                name="Spectators"
                value={users.byPersona.spectator}
              />
              <LegendRow color={SEG.artist} name="Artists" value={users.byPersona.artist} />
              <LegendRow color={SEG.venue} name="Venues" value={users.byPersona.venue} />
            </div>
          </Panel>

          <Panel icon={UserPlus} title="New users">
            <div className="grid grid-cols-2 gap-2.5">
              <MiniStat value={users.newLast7Days} label="This week" />
              <MiniStat value={users.newPrev7Days} label="Previous week" />
            </div>
            <div className="mt-auto">
              <TrendPill trend={users.trend30d} label="vs. last month" />
            </div>
          </Panel>

          <Panel
            icon={Activity}
            title="Active users"
            hint="Counts people who signed in during the period. Anyone active in the last 7 days is also counted in the last 30, so the 30-day number is always equal to or higher."
          >
            <div className="grid grid-cols-2 gap-2.5">
              <MiniStat value={sessions.activeLast7Days} label="Last 7 days" />
              <MiniStat value={sessions.activeLast30Days} label="Last 30 days" />
            </div>
            <div className="mt-auto text-xs text-muted-foreground">Distinct sign-ins</div>
          </Panel>
        </div>
      </Section>

      {/* Content */}
      <Section title="Content">
        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <Panel icon={CalendarDays} title="Events by status">
            <ProportionBar
              segments={[
                { value: events.byStatus.active, color: SEG.active },
                { value: events.byStatus.archived, color: SEG.archived },
                { value: events.byStatus.removed, color: SEG.removed },
              ]}
            />
            <div className="flex flex-col gap-2">
              <LegendRow color={SEG.active} name="Active (live)" value={events.byStatus.active} />
              <LegendRow color={SEG.archived} name="Archived" value={events.byStatus.archived} />
              <LegendRow color={SEG.removed} name="Removed" value={events.byStatus.removed} />
            </div>
          </Panel>

          <Panel icon={Music2} title="Top categories">
            {topCategories.length === 0 ? (
              <div className="rounded-lg bg-muted py-3 text-center text-xs text-muted-foreground">
                No events yet
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {topCategories.slice(0, 3).map((tc) => (
                  <RankRow
                    key={tc.category}
                    name={tc.category}
                    value={tc.count}
                    max={maxCategory}
                  />
                ))}
              </div>
            )}
            <div className="mt-auto text-xs text-muted-foreground">
              {categoriesInUse.toLocaleString()} {categoriesInUse === 1 ? 'category' : 'categories'}{' '}
              in use
            </div>
          </Panel>
        </div>
      </Section>

      {/* Marketplace & community */}
      <Section title="Marketplace & community">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Panel
            icon={Handshake}
            title="Bookings"
            hint="Performance links between artists and venues, grouped by who started them. A venue invite or an artist application both create a booking, which is then accepted, rejected, or cancelled."
          >
            <div className="flex flex-col gap-1.5">
              <Row label="Venue invites" value={bookings.byDirection.venue_to_artist} />
              <Row label="Artist requests" value={bookings.byDirection.artist_to_venue} />
              <Row label="Co-artist" value={bookings.byDirection.artist_to_artist} />
            </div>
          </Panel>

          <Panel icon={Heart} title="Community">
            <div className="flex flex-col gap-1.5">
              <Row label="Follow connections" value={engagement.totalFollows} />
              <Row label="Posts" value={engagement.totalPosts} />
              <Row label="Avg likes / post" value={engagement.avgLikesPerPost} />
            </div>
          </Panel>

          <Panel
            icon={ShieldAlert}
            title="Moderation"
            hint="Events an admin has removed. New events go live instantly — admins can take one down afterwards if needed. Nothing waits for approval."
          >
            <div className="flex flex-col gap-1.5">
              <Row label="Removed · last 7 days" value={moderation.removedLast7Days} />
              <Row label="Removed · all time" value={moderation.removedTotal} />
              <Row label="Currently live" value={events.byStatus.active} />
            </div>
          </Panel>
        </div>
      </Section>
    </div>
  );
}
