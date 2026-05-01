import { and, asc, count, desc, ilike, ne } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';
import { adminUsersListInputSchema } from '@CeolX/shared/validators';

import { adminProcedure, router } from '../../index';
import { EXPORT_MAX_ROWS, computePagination, shapeUserRow } from '../../lib/admin-users';

const SORT_COLUMNS = {
  name: user.name,
  email: user.email,
  createdAt: user.createdAt,
  lastLoginAt: user.lastLoginAt,
} as const;

const NON_ADMIN = ne(user.currentRole, 'admin');

const list = adminProcedure.input(adminUsersListInputSchema).query(async ({ input }) => {
  const filter = input.search ? and(NON_ADMIN, ilike(user.email, `%${input.search}%`)) : NON_ADMIN;

  const orderColumn = SORT_COLUMNS[input.sortBy];
  const orderFn = input.sortDir === 'asc' ? asc : desc;

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        currentRole: user.currentRole,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        flaggedInactive: user.flaggedInactive,
      })
      .from(user)
      .where(filter)
      .orderBy(orderFn(orderColumn))
      .limit(input.limit)
      .offset((input.page - 1) * input.limit),
    db.select({ count: count() }).from(user).where(filter),
  ]);

  const total = totalRow[0]?.count ?? 0;

  return {
    users: rows.map((r) =>
      shapeUserRow({
        id: r.id,
        name: r.name,
        email: r.email,
        currentRole: r.currentRole,
        createdAt: r.createdAt,
        lastLoginAt: r.lastLoginAt,
        flaggedInactive: r.flaggedInactive ?? false,
      })
    ),
    pagination: computePagination({ total, page: input.page, limit: input.limit }),
  };
});

const exportInputSchema = adminUsersListInputSchema.omit({ page: true, limit: true });

const exportAll = adminProcedure.input(exportInputSchema).query(async ({ input }) => {
  const filter = input.search ? and(NON_ADMIN, ilike(user.email, `%${input.search}%`)) : NON_ADMIN;
  const orderColumn = SORT_COLUMNS[input.sortBy];
  const orderFn = input.sortDir === 'asc' ? asc : desc;

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      currentRole: user.currentRole,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      flaggedInactive: user.flaggedInactive,
    })
    .from(user)
    .where(filter)
    .orderBy(orderFn(orderColumn))
    .limit(EXPORT_MAX_ROWS);

  return {
    users: rows.map((r) =>
      shapeUserRow({
        id: r.id,
        name: r.name,
        email: r.email,
        currentRole: r.currentRole,
        createdAt: r.createdAt,
        lastLoginAt: r.lastLoginAt,
        flaggedInactive: r.flaggedInactive ?? false,
      })
    ),
    cap: EXPORT_MAX_ROWS,
  };
});

export const usersRouter = router({ list, exportAll });
