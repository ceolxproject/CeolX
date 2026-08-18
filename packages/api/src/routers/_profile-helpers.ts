import { and, eq, ne, sql } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { follows } from '@CeolX/db/schema/social';
import { artistProfiles, profileSocialLinks, venueProfiles } from '@CeolX/db/schema/users';
import { ProfileVisibility } from '@CeolX/shared';

import { onHoldVenueIds } from '../services/venue-gate.js';

/**
 * Get follower and following counts for a user.
 * Shared across artist and venue profile queries.
 *
 * `followingCount` counts only followees that are actually rendered in the
 * Following list — those with a public artist/venue profile, excluding
 * self-follows — so the header number always matches the list. Profile presence
 * only, NOT `isActive`: the list lookup is de-gated (Asana 1215489113550392) so
 * inactive (e.g. unsubscribed venue) profiles still render; the count must match.
 * `followerCount` stays a raw count because the Followers list renders every
 * follower (spectators included, via a base-user fallback), so it never filters.
 */
export async function getFollowerCounts(userId: string) {
  const [followerResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(follows)
    .where(eq(follows.followeeId, userId));

  // Filter to followees with a public profile (artist OR venue), mirroring the
  // per-row filter in follows.getFollowing, so the header count never drifts from
  // the rendered list (count 6 vs list 5 when a followed account is deleted or
  // downgraded to spectator). Presence only, NOT isActive — the list lookup is
  // de-gated so inactive (unsubscribed) profiles still render and must be counted.
  // Asana 1216029059011258 / 1215489113550392.
  const [followingResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(follows)
    .where(
      and(
        eq(follows.followerId, userId),
        ne(follows.followeeId, userId),
        sql`(
          exists (
            select 1 from ${artistProfiles}
            where ${artistProfiles.userId} = ${follows.followeeId}
          )
          or exists (
            select 1 from ${venueProfiles}
            where ${venueProfiles.userId} = ${follows.followeeId}
          )
        )`
      )
    );

  return {
    followerCount: followerResult?.count ?? 0,
    followingCount: followingResult?.count ?? 0,
  };
}

/**
 * Public-visibility predicate shared by artists.byId, venues.byId,
 * profiles.getByUsername and the /u/<username> share page, so "is this profile
 * public?" lives in ONE place and those surfaces cannot diverge.
 *
 * Returns a three-way state, not a boolean (M8-T0 D-52). "On hold" has to stay
 * distinguishable from "does not exist": an unpaid venue must read as the venue's
 * own lapse, never as CeolX being broken. Collapsing the two into `false` is
 * precisely the bug D-52 exists to prevent, and it is what the previous version
 * of this function did.
 *
 * Artist profiles have no on-hold state — `is_active` there means "persona
 * switched away" (an unrelated concept from billing, and default true), so an
 * inactive artist is genuinely absent.
 */
export async function resolveProfileVisibility(
  role: 'artist' | 'venue',
  profile: { id: string; isActive?: boolean | null; subscriptionStatus?: string | null },
  viewerId: string | undefined,
  ownerId: string
): Promise<ProfileVisibility> {
  // The owner always sees their own profile — they need to reach it to fix payment.
  if (viewerId && viewerId === ownerId) return ProfileVisibility.VISIBLE;

  if (role === 'artist') {
    return profile.isActive === true ? ProfileVisibility.VISIBLE : ProfileVisibility.NOT_FOUND;
  }

  // Delegates to the gate rather than re-deriving it. This used to duplicate the
  // VENUE_GATE_ENABLED check and the grace-window arithmetic, which is how it came to
  // miss `billing_blocked` entirely — a disputed venue stayed publicly visible here
  // while every other surface hid it. One reader, one rule (D-13).
  //
  // `onHoldVenueIds` short-circuits without a query while the gate is off, which is
  // the shipping default, so the common path costs nothing.
  const onHold = await onHoldVenueIds([profile.id]);
  return onHold.has(profile.id) ? ProfileVisibility.ON_HOLD : ProfileVisibility.VISIBLE;
}

/**
 * Get social links for a user as a Record<platform, url>.
 * Shared across artist and venue profile queries.
 */
export async function getSocialLinksRecord(userId: string) {
  const links = await db
    .select({ platform: profileSocialLinks.platform, url: profileSocialLinks.url })
    .from(profileSocialLinks)
    .where(eq(profileSocialLinks.userId, userId));

  const record: Record<string, string> = {};
  for (const link of links) {
    record[link.platform] = link.url;
  }
  return record;
}

/**
 * Replace all social links for a user within a transaction.
 * Deletes existing links then inserts new ones.
 */
export async function upsertSocialLinks(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
  socialLinks?: Record<string, string | undefined>
) {
  if (!socialLinks) return;

  await tx.delete(profileSocialLinks).where(eq(profileSocialLinks.userId, userId));

  const linkRows = Object.entries(socialLinks)
    .filter((entry): entry is [string, string] => !!entry[1] && entry[1] !== '')
    .map(([platform, url]) => ({
      userId,
      platform: platform as 'INSTAGRAM' | 'FACEBOOK' | 'TIKTOK' | 'YOUTUBE' | 'WEBSITE' | 'TWITTER',
      url,
    }));

  if (linkRows.length > 0) {
    await tx.insert(profileSocialLinks).values(linkRows);
  }
}
