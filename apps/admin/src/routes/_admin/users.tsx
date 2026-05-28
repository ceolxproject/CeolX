import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { ChevronDown, ChevronUp, ChevronsUpDown, Download } from 'lucide-react';
import { useState } from 'react';

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

import { SearchInput } from '@/components/SearchInput';
import { buildCsv, downloadCsv } from '@/lib/csv';
import { trpcClient, trpc } from '@/utils/trpc';

export const Route = createFileRoute('/_admin/users')({
  component: UsersPage,
});

type SortField = 'name' | 'email' | 'createdAt' | 'lastLoginAt';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 20;

const columns: Array<{ key: SortField | 'role' | 'flagged'; header: string; sortable?: boolean }> =
  [
    { key: 'name', header: 'Name', sortable: true },
    { key: 'email', header: 'Email', sortable: true },
    { key: 'role', header: 'Persona' },
    { key: 'createdAt', header: 'Registered', sortable: true },
    { key: 'lastLoginAt', header: 'Last Login', sortable: true },
    { key: 'flagged', header: 'Inactive' },
  ];

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function UsersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [exporting, setExporting] = useState(false);

  const { data, isLoading, isFetching } = useQuery(
    trpc.admin.users.list.queryOptions({
      page,
      limit: PAGE_SIZE,
      search: search || undefined,
      sortBy,
      sortDir,
    })
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

  async function handleExport() {
    setExporting(true);
    try {
      const result = await trpcClient.admin.users.exportAll.query({
        search: search || undefined,
        sortBy,
        sortDir,
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
    } finally {
      setExporting(false);
    }
  }

  const users = data?.users ?? [];
  const total = data?.pagination.total ?? 0;
  const totalPages = data?.pagination.totalPages ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Users</h1>

      <div className="flex items-center justify-between gap-4 flex-wrap pr-2">
        <div className="flex-1 max-w-sm">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search by email"
          />
        </div>
        <Button onClick={handleExport} disabled={exporting || total === 0}>
          <Download size={16} />
          {exporting ? 'Exporting…' : 'Export CSV'}
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key}>
                  {col.sortable ? (
                    <button
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                      onClick={() => handleSort(col.key as SortField)}
                    >
                      {col.header}
                      {sortBy === col.key ? (
                        sortDir === 'asc' ? (
                          <ChevronUp size={14} />
                        ) : (
                          <ChevronDown size={14} />
                        )
                      ) : (
                        <ChevronsUpDown size={14} className="opacity-40" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`skel-${i}`}>
                  {columns.map((c) => (
                    <TableCell key={c.key}>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center text-muted-foreground py-8"
                >
                  {search ? `No users matching "${search}".` : 'No users yet.'}
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <span className="capitalize">{u.currentRole}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(u.createdAt)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(u.lastLoginAt)}
                  </TableCell>
                  <TableCell>
                    {u.flaggedInactive ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-warning/20 text-warning">
                        Inactive
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
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
          {isFetching && !isLoading ? ' · updating…' : ''}
        </span>
        {totalPages > 1 && (
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded border border-border disabled:opacity-40 hover:bg-muted transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 rounded border border-border disabled:opacity-40 hover:bg-muted transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
