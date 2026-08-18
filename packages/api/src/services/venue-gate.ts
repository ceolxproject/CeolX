import { eq, inArray } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { venueSubscriptions } from '@CeolX/db/schema/subscriptions';
import { venueProfiles } from '@CeolX/db/schema/users';
import { env } from '@CeolX/env/server';
import { ProfileVisibility, venueVisibilityFor, type VenueSubscriptionStatus } from '@CeolX/shared';

// Per-surface venue visibility (M8-T0 Section 9).
//
// There is no single "hide this venue" flag, and that is the whole difficulty of
// this feature. Sean's answers produced five different outcomes:
//
//   V-01 venue profile ............... hidden (rendered as "on hold")
//   V-03 venue's OWN events .......... off map and feed
//   V-06 ARTIST events at that venue . stay visible
//   V-07 venue's posts ............... stay visible
//   V-09 artist's venue picker ....... listed, badged, unselectable
//
// So whether an event is hidden depends on WHO CREATED IT, not on which venue it
// names. Map and feed read from Typesense, whose event document carries
// `creator_id` but no subscription state — deliberately, per D-54. Rather than
// indexing that state (which would need a fan-out re-index of every one of a
// venue's events on each subscription change, plus a window where a venue that just
// paid is still invisible), these helpers post-filter the ids a query already
// returned. One lookup over at most a few hundred ids.
//
// ponytail: post-filter, not indexed state. If unpaid venues ever become a large
// share of results, over-fetching stops covering the shortfall and the flag has to
// move into the index — see D-55.

/** Gate switch (O-08). Off means every venue is treated as visible. */
function isVenueGateEnabled(): boolean {
  return env.VENUE_GATE_ENABLED === 'true';
}

function graceEndFor(pastDueSince: Date | null): Date | null {
  if (!pastDueSince) return null;
  return new Date(pastDueSince.getTime() + env.STRIPE_GRACE_DAYS * 24 * 60 * 60 * 1000);
}

interface GateRow {
  venueId: string;
  userId: string;
  subscriptionStatus: VenueSubscriptionStatus;
  pastDueSince: Date | null;
}

/**
 * Which of these venues are on hold?
 *
 * Accepts either venue-profile ids or the owning user ids, because the two
 * identifiers show up on different surfaces: events carry the owner's `creator_id`
 * while the venue picker deals in profile ids.
 */
async function loadGateRows(by: 'venueId' | 'userId', ids: readonly string[]): Promise<GateRow[]> {
  const column = by === 'venueId' ? venueProfiles.id : venueProfiles.userId;

  return (
    db
      .select({
        venueId: venueProfiles.id,
        userId: venueProfiles.userId,
        subscriptionStatus: venueProfiles.subscriptionStatus,
        pastDueSince: venueSubscriptions.pastDueSince,
      })
      .from(venueProfiles)
      // LEFT join: a venue with no billing row at all is still a venue, and it is
      // `inactive`, which is exactly the case the gate exists for. An inner join here
      // would silently treat every never-subscribed venue as visible.
      .leftJoin(venueSubscriptions, eq(venueSubscriptions.venueId, venueProfiles.id))
      .where(inArray(column, [...ids]))
  );
}

function onHold(row: GateRow): boolean {
  return (
    venueVisibilityFor({
      status: row.subscriptionStatus,
      graceEndsAt: graceEndFor(row.pastDueSince),
    }) === ProfileVisibility.ON_HOLD
  );
}

/**
 * Venue-owner user ids that are on hold, out of the ids given.
 *
 * Used to drop a venue's OWN events from map and feed (V-03). An event whose
 * creator is not in the returned set stays visible — which is what keeps
 * artist-created events at an unpaid venue on the map (V-06).
 */
export async function onHoldVenueUserIds(creatorIds: readonly string[]): Promise<Set<string>> {
  if (!isVenueGateEnabled() || creatorIds.length === 0) return new Set();

  const unique = [...new Set(creatorIds)];
  const rows = await loadGateRows('userId', unique);

  return new Set(rows.filter(onHold).map((r) => r.userId));
}

/**
 * Venue-profile ids that are on hold, out of the ids given.
 *
 * Used where the surface deals in profile ids: the artist's venue picker (V-09,
 * which badges rather than removes) and feed ads (V-11, which excludes).
 */
export async function onHoldVenueIds(venueIds: readonly string[]): Promise<Set<string>> {
  if (!isVenueGateEnabled() || venueIds.length === 0) return new Set();

  const unique = [...new Set(venueIds)];
  const rows = await loadGateRows('venueId', unique);

  return new Set(rows.filter(onHold).map((r) => r.venueId));
}

/**
 * Drop items created by an on-hold venue.
 *
 * The shared shape behind V-03 on map, feed and collections, so the "whose event is
 * it" rule is written once. A missing creator id keeps the item — failing open here
 * is right: wrongly hiding a paying venue's event is worse than briefly showing an
 * unpaid one, and a null creator is a data problem rather than a billing signal.
 */
export async function filterOutOnHoldVenueItems<T>(
  items: readonly T[],
  creatorIdOf: (item: T) => string | null | undefined
): Promise<T[]> {
  if (!isVenueGateEnabled() || items.length === 0) return [...items];

  const creatorIds = items
    .map(creatorIdOf)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  const hidden = await onHoldVenueUserIds(creatorIds);
  if (hidden.size === 0) return [...items];

  return items.filter((item) => {
    const creatorId = creatorIdOf(item);
    return !creatorId || !hidden.has(creatorId);
  });
}
