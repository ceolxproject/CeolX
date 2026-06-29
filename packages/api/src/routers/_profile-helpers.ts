import { and, eq, ne, sql } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { follows } from '@CeolX/db/schema/social';
import { artistProfiles, profileSocialLinks, venueProfiles } from '@CeolX/db/schema/users';

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
