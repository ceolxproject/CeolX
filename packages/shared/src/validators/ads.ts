import { z } from 'zod';

/**
 * Input for `events.feedAds`. Empty in V1 — exists so future filters
 * (city, persona, etc.) have a defined home instead of ad-hoc growth.
 */
export const feedAdsInputSchema = z.object({}).optional();

export type FeedAdsInput = z.infer<typeof feedAdsInputSchema>;
