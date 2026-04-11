import { z } from 'zod';

export const MapQueryInput = z.object({
  swLat: z.number(),
  swLng: z.number(),
  neLat: z.number(),
  neLng: z.number(),
  query: z.string().max(100).optional(),
  limit: z.number().int().min(1).max(50).default(50),
  category: z.string().optional(),
  county: z.string().optional(),
  dateRange: z.enum(['today', 'this_week', 'this_weekend', 'this_month']).optional(),
});

/**
 * Builds a Typesense date_start filter string.
 * When no dateRange is given, returns everything from now onwards.
 */
export function buildDateFilter(
  dateRange: 'today' | 'this_week' | 'this_weekend' | 'this_month' | undefined,
  nowUnix: number
): string {
  if (!dateRange) return ` && date_start:>=${nowUnix}`;

  const now = new Date();
  let rangeStart: Date;
  let rangeEnd: Date;

  switch (dateRange) {
    case 'today':
      rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      rangeEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      break;
    case 'this_week': {
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
      rangeEnd = new Date(
        rangeStart.getFullYear(),
        rangeStart.getMonth(),
        rangeStart.getDate() + 7
      );
      break;
    }
    case 'this_weekend': {
      const day = now.getDay();
      const satOffset = day === 0 ? -1 : 6 - day;
      rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + satOffset);
      rangeEnd = new Date(
        rangeStart.getFullYear(),
        rangeStart.getMonth(),
        rangeStart.getDate() + 2
      );
      break;
    }
    case 'this_month':
      rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
      rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      break;
  }

  const startUnix = Math.max(Math.floor(rangeStart.getTime() / 1000), nowUnix);
  const endUnix = Math.floor(rangeEnd.getTime() / 1000);
  return ` && date_start:>=${startUnix} && date_start:<${endUnix}`;
}
