import { z } from 'zod';

export const eventAnalyticsInputSchema = z.object({
  id: z.string().uuid(),
});

export const trackTicketClickInputSchema = z.object({
  id: z.string().uuid(),
});

export const dailyViewBucketSchema = z.object({
  date: z.string(), // YYYY-MM-DD
  count: z.number().int().nonnegative(),
});

export const performerSchema = z.object({
  artistProfileId: z.string(),
  stageName: z.string(),
  profileImageUrl: z.string().nullable(),
});

export const eventAnalyticsResponseSchema = z.object({
  event: z.object({
    id: z.string().uuid(),
    title: z.string(),
    coverImage: z.string().nullable(),
    dateStart: z.string(),
    dateEnd: z.string().nullable(),
    venueAddress: z.string().nullable(),
    category: z.string(),
    status: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    hasTicketLink: z.boolean(),
  }),
  views: z.object({
    total: z.number().int().nonnegative(),
    daily: z.array(dailyViewBucketSchema),
  }),
  saves: z.object({
    total: z.number().int().nonnegative(),
  }),
  engagement: z.object({
    rate: z.number().nonnegative(),
  }),
  ticketClicks: z.object({
    total: z.number().int().nonnegative(),
    clickRate: z.number().nullable(),
  }),
  bookings: z.object({
    total: z.number().int().nonnegative(),
    byStatus: z.object({
      pending: z.number().int().nonnegative(),
      accepted: z.number().int().nonnegative(),
      rejected: z.number().int().nonnegative(),
      cancelled: z.number().int().nonnegative(),
    }),
    acceptanceRate: z.number().nullable(),
  }),
  performers: z.object({
    confirmed: z.array(performerSchema),
    invitedCount: z.number().int().nonnegative(),
  }),
  cachedAt: z.string(),
  cacheExpiresAt: z.string(),
});

export type DailyViewBucket = z.infer<typeof dailyViewBucketSchema>;
export type Performer = z.infer<typeof performerSchema>;
export type EventAnalyticsResponse = z.infer<typeof eventAnalyticsResponseSchema>;
