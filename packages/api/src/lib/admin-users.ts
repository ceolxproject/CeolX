/**
 * Pure helpers for the admin users.list / users.exportAll procedures.
 *
 * Pagination math + row serialization live here so the tRPC procedure stays
 * thin and the wire shape stays unit-testable without DB mocks.
 */

export const EXPORT_MAX_ROWS = 5000;

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export function computePagination(input: {
  total: number;
  page: number;
  limit: number;
}): Pagination {
  const totalPages = input.total === 0 ? 0 : Math.ceil(input.total / input.limit);
  return {
    page: input.page,
    limit: input.limit,
    total: input.total,
    totalPages,
  };
}

export type RawUserRow = {
  id: string;
  name: string;
  email: string;
  currentRole: string;
  createdAt: Date;
  lastLoginAt: Date | null;
  flaggedInactive: boolean;
};

export type UserRow = {
  id: string;
  name: string;
  email: string;
  currentRole: string;
  createdAt: string;
  lastLoginAt: string | null;
  flaggedInactive: boolean;
};

export function shapeUserRow(raw: RawUserRow): UserRow {
  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    currentRole: raw.currentRole,
    createdAt: raw.createdAt.toISOString(),
    lastLoginAt: raw.lastLoginAt ? raw.lastLoginAt.toISOString() : null,
    flaggedInactive: raw.flaggedInactive,
  };
}
