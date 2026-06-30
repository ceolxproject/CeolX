import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import {
  BadgeCheck,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  Download,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import type { AuthMethod, UserPersonaFilter } from '@CeolX/shared/validators';
import { Avatar, AvatarFallback, AvatarImage } from '@CeolX/ui/components/avatar';
import { Badge } from '@CeolX/ui/components/badge';
import { Button } from '@CeolX/ui/components/button';
import { Skeleton } from '@CeolX/ui/components/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@CeolX/ui/components/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@CeolX/ui/components/tooltip';
import { cn } from '@CeolX/ui/lib/utils';

import { SearchInput } from '@/components/SearchInput';
import { UserDetailSheet } from '@/components/UserDetailSheet';
import {
  EMPTY_FILTERS,
  UserFilterChips,
  UsersFilters,
  countActiveFilters,
  type UserFilters,
} from '@/components/UsersFilterBar';
import { buildCsv, downloadCsv } from '@/lib/csv';
import { relativeTime } from '@/lib/format';
import { initials, PERSONA_CLASS } from '@/lib/userBadges';
import { trpcClient, trpc } from '@/utils/trpc';

export const Route = createFileRoute('/_admin/users')({
  component: UsersPage,
});

type SortField = 'name' | 'lastLoginAt' | 'createdAt';
type SortDir = 'asc' | 'desc';
type Persona = 'all' | 'spectator' | 'artist' | 'venue';

const PAGE_SIZE = 20;

const AUTH_BADGE: Record<string, { l: string; bg: string; label: string }> = {
  credential: { l: '@', bg: '#6B7280', label: 'Email' },
  google: { l: 'G', bg: '#EA4335', label: 'Google' },
  apple: { l: 'A', bg: '#111111', label: 'Apple' },
};

const TABS: Array<{ key: Persona; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'spectator', label: 'Spectators' },
  { key: 'artist', label: 'Artists' },
  { key: 'venue', label: 'Venues' },
];

type UserRow = {
  id: string;
  name: string;
  email: string;
  currentRole: string;
  image: string | null;
  profileImageUrl: string | null;
  emailVerified: boolean;
  flaggedInactive: boolean;
  venueSubscriptionStatus: string | null;
  artistActive: boolean | null;
  eventsCount: number;
  authProviders: string[];
  lastLoginAt: string | null;
};

function AuthCell({ providers }: { providers: string[] }) {
  const [first, ...rest] = providers;
  if (!first) return <span className="text-xs text-muted-foreground">—</span>;
  const b = AUTH_BADGE[first] ?? { l: '?', bg: '#6B7280', label: first };
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
      <span
        className="grid size-4 place-items-center rounded text-[9px] font-bold text-white"
        style={{ background: b.bg }}
      >
        {b.l}
      </span>
      {b.label}
      {rest.length > 0 && <span className="text-xs">+{rest.length}</span>}
    </span>
  );
}

function UsersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [persona, setPersona] = useState<Persona>('all');
  const [sortBy, setSortBy] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filters, setFilters] = useState<UserFilters>(EMPTY_FILTERS);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const { data: summary } = useQuery(trpc.admin.users.summary.queryOptions());

  const filterArgs = {
    search: search || undefined,
    persona: persona === 'all' ? undefined : ([persona] as UserPersonaFilter[]),
    authMethod: filters.authMethod.length ? (filters.authMethod as AuthMethod[]) : undefined,
    emailVerified: filters.emailVerified,
    flaggedInactive: filters.flaggedInactive,
    marketingConsent: filters.marketingConsent,
    registeredFrom: filters.registeredFrom,
    registeredTo: filters.registeredTo,
  };

  const { data, isLoading, isFetching, isError } = useQuery(
    trpc.admin.users.list.queryOptions({ page, limit: PAGE_SIZE, sortBy, sortDir, ...filterArgs })
  );

  function handleSort(key: SortField) {
    if (sortBy !== key) {
      setSortBy(key);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortBy('createdAt');
      setSortDir('desc');
    }
    setPage(1);
  }

  function setTab(p: Persona) {
    setPersona(p);
    setPage(1);
  }

  function updateFilters(next: UserFilters) {
    setFilters(next);
    setPage(1);
  }

  async function handleExport() {
    setExporting(true);
    try {
      const result = await trpcClient.admin.users.exportAll.query({
        sortBy,
        sortDir,
        ...filterArgs,
      });
      const csv = buildCsv(
        ['name', 'email', 'current_role', 'created_at', 'last_login_at', 'flagged_inactive'],
        result.users.map((u) => ({
          name: u.name,
          email: u.email,
          current_role: u.currentRole,
          created_at: u.createdAt,
          last_login_at: u.lastLoginAt ?? '',
          flagged_inactive: u.flaggedInactive,
        }))
      );
      const stamp = new Date().toISOString().slice(0, 10);
      downloadCsv(csv, `ceolx_users_export_${stamp}.csv`);
    } catch {
      toast.error('Could not export users. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  const users = (data?.users ?? []) as UserRow[];
  const total = data?.pagination.total ?? 0;
  const totalPages = data?.pagination.totalPages ?? 0;
  const tabCount = (p: Persona) => (p === 'all' ? summary?.total : summary?.[`${p}s`]);

  const COL_COUNT = 6;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {summary
            ? `${summary.total} people across CeolX — spectators, artists and venues.`
            : 'Loading…'}
        </p>
      </div>

      <div className="inline-flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors',
              persona === t.key
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
            <span
              className={cn(
                'text-[11px] font-bold',
                persona === t.key ? 'text-primary' : 'text-muted-foreground/70'
              )}
            >
              {tabCount(t.key) ?? '·'}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="min-w-[240px] max-w-sm flex-1">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search by name or email"
            maxLength={100}
          />
        </div>
        <UsersFilters filters={filters} onChange={updateFilters} resultCount={total} />
        <div className="flex-1" />
        <Button onClick={handleExport} disabled={exporting || total === 0}>
          <Download size={16} />
          {exporting ? 'Exporting…' : 'Export CSV'}
        </Button>
      </div>

      {countActiveFilters(filters) > 0 && (
        <UserFilterChips filters={filters} onChange={updateFilters} />
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <SortButton
                  label="User"
                  active={sortBy === 'name'}
                  dir={sortDir}
                  onClick={() => handleSort('name')}
                />
              </TableHead>
              <TableHead>Persona</TableHead>
              <TableHead>Sign-in</TableHead>
              <TableHead className="text-right">Events</TableHead>
              <TableHead>
                <SortButton
                  label="Last active"
                  active={sortBy === 'lastLoginAt'}
                  dir={sortDir}
                  onClick={() => handleSort('lastLoginAt')}
                />
              </TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isError ? (
              <TableRow>
                <TableCell colSpan={COL_COUNT} className="py-10 text-center text-destructive">
                  Couldn’t load users. Check your connection and try again.
                </TableCell>
              </TableRow>
            ) : isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={`skel-${i}`}>
                  {Array.from({ length: COL_COUNT }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COL_COUNT} className="py-10 text-center text-muted-foreground">
                  {search || countActiveFilters(filters) > 0 || persona !== 'all'
                    ? 'No users match these filters. Try clearing one.'
                    : 'No users yet.'}
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow
                  key={u.id}
                  onClick={() => setSelectedUserId(u.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedUserId(u.id);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`View ${u.name}`}
                  className="cursor-pointer focus-visible:bg-muted/60 focus-visible:outline-none"
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-9">
                        {(u.profileImageUrl ?? u.image) && (
                          <AvatarImage
                            src={(u.profileImageUrl ?? u.image) as string}
                            alt={u.name}
                          />
                        )}
                        <AvatarFallback>{initials(u.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-semibold">{u.name}</div>
                        <div className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                          <span className="truncate">{u.email}</span>
                          {u.emailVerified && (
                            <TooltipProvider delay={150}>
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <span
                                      className="inline-flex shrink-0 items-center text-emerald-600"
                                      role="img"
                                      aria-label="Email verified"
                                    />
                                  }
                                >
                                  <BadgeCheck size={14} strokeWidth={2.5} />
                                </TooltipTrigger>
                                <TooltipContent>Email verified</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn('capitalize', PERSONA_CLASS[u.currentRole])}
                    >
                      {u.currentRole}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <AuthCell providers={u.authProviders} />
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {u.currentRole === 'spectator' ? (
                      <span
                        className="font-sans font-normal text-muted-foreground"
                        title="Spectators don't create events"
                      >
                        N/A
                      </span>
                    ) : (
                      u.eventsCount
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {relativeTime(u.lastLoginAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <ChevronRight size={16} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total === 0
            ? 'No users'
            : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}`}
          {countActiveFilters(filters) > 0 && ` · ${countActiveFilters(filters)} filters active`}
          {isFetching && !isLoading ? ' · updating…' : ''}
        </span>
        {totalPages > 1 && (
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded border border-border px-3 py-1 transition-colors hover:bg-muted disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded border border-border px-3 py-1 transition-colors hover:bg-muted disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>

      <UserDetailSheet userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
    </div>
  );
}

function SortButton({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <button
      className="flex items-center gap-1 transition-colors hover:text-foreground"
      onClick={onClick}
    >
      {label}
      {active ? (
        dir === 'asc' ? (
          <ChevronUp size={14} />
        ) : (
          <ChevronDown size={14} />
        )
      ) : (
        <ChevronsUpDown size={14} className="opacity-40" />
      )}
    </button>
  );
}
