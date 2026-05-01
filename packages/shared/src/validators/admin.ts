import { z } from 'zod';

export const USER_SORT_FIELDS = ['name', 'email', 'createdAt', 'lastLoginAt'] as const;
export type UserSortField = (typeof USER_SORT_FIELDS)[number];

export const SORT_DIRECTIONS = ['asc', 'desc'] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

const optionalTrimmedSearch = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

export const adminUsersListInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  search: optionalTrimmedSearch,
  sortBy: z.enum(USER_SORT_FIELDS).default('createdAt'),
  sortDir: z.enum(SORT_DIRECTIONS).default('desc'),
});

export type AdminUsersListInput = z.infer<typeof adminUsersListInputSchema>;
