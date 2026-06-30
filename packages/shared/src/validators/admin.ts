import { z } from 'zod';

export const USER_SORT_FIELDS = ['name', 'email', 'createdAt', 'lastLoginAt'] as const;
export type UserSortField = (typeof USER_SORT_FIELDS)[number];

export const SORT_DIRECTIONS = ['asc', 'desc'] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

// Personas an admin can filter on (excludes the single internal `admin` account).
export const USER_PERSONA_FILTERS = ['spectator', 'artist', 'venue'] as const;
export type UserPersonaFilter = (typeof USER_PERSONA_FILTERS)[number];

// BetterAuth `account.providerId` values: 'credential' = email/password.
export const AUTH_METHODS = ['credential', 'google', 'apple'] as const;
export type AuthMethod = (typeof AUTH_METHODS)[number];

const optionalTrimmedSearch = z
  .string()
  .trim()
  .max(100, { error: 'Search is limited to 100 characters' })
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

// Filters shared by list + exportAll so a CSV export honours the on-screen filters.
const adminUsersFilters = {
  search: optionalTrimmedSearch,
  persona: z.array(z.enum(USER_PERSONA_FILTERS)).optional(),
  authMethod: z.array(z.enum(AUTH_METHODS)).optional(),
  emailVerified: z.boolean().optional(),
  flaggedInactive: z.boolean().optional(),
  marketingConsent: z.boolean().optional(),
  registeredFrom: z.iso.date().optional(), // YYYY-MM-DD (from <input type="date">)
  registeredTo: z.iso.date().optional(),
};

// from <= to. ISO date strings compare chronologically with <=, so no parsing.
const isValidDateRange = (v: { registeredFrom?: string; registeredTo?: string }) =>
  !v.registeredFrom || !v.registeredTo || v.registeredFrom <= v.registeredTo;
const dateRangeError = {
  error: 'The "from" date must be on or before the "to" date.',
  path: ['registeredTo'],
};

const adminUsersListInputObject = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(USER_SORT_FIELDS).default('createdAt'),
  sortDir: z.enum(SORT_DIRECTIONS).default('desc'),
  ...adminUsersFilters,
});

export const adminUsersListInputSchema = adminUsersListInputObject.refine(
  isValidDateRange,
  dateRangeError
);

// Same filters as the list minus paging — CSV export honours the on-screen filters.
export const adminUsersExportInputSchema = adminUsersListInputObject
  .omit({ page: true, limit: true })
  .refine(isValidDateRange, dateRangeError);

export type AdminUsersListInput = z.infer<typeof adminUsersListInputSchema>;
export type AdminUsersExportInput = z.infer<typeof adminUsersExportInputSchema>;

export const adminUserDetailInputSchema = z.object({
  userId: z.string().min(1),
});

export type AdminUserDetailInput = z.infer<typeof adminUserDetailInputSchema>;
