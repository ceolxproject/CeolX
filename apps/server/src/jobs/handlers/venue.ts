import type { JobPayload } from '../types.js';

// TODO M8-Stripe: implement Stripe webhook failure retry for venue subscription
export async function handleVenueSubscriptionRetry(
  _payload: JobPayload<'venue.subscription-retry'>
): Promise<void> {
  return Promise.reject(new Error('Not implemented'));
}
