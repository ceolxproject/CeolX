import { EventStatus } from '../enums.js';
import type { ArtistSummary, VenueSummary, EventSummary } from '../types.js';

export function isArtistProfile(profile: unknown): profile is ArtistSummary {
  return (
    typeof profile === 'object' &&
    profile !== null &&
    'displayName' in profile &&
    'genres' in profile
  );
}

export function isVenueProfile(profile: unknown): profile is VenueSummary {
  return (
    typeof profile === 'object' &&
    profile !== null &&
    'name' in profile &&
    'subscriptionStatus' in profile
  );
}

export function isEventActive(event: EventSummary): boolean {
  return event.status === EventStatus.ACTIVE && new Date(event.dateStart) > new Date();
}
