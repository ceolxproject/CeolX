import { inArray } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';
import { artistProfiles, venueProfiles } from '@CeolX/db/schema/users';

export type HydratedAuthor = {
  id: string;
  displayName: string;
  profileImageUrl: string | null;
  profileType: 'artist' | 'venue' | 'user';
};

/**
 * Resolve author display info for a set of user IDs. Prefers artist profile
 * stageName, falls back to venue profile venueName, then user.name. Profile
 * image follows the same precedence (artist → venue → user.image). Returns a
 * Map keyed by userId so callers can hydrate per-row cheaply.
 */
export async function hydrateAuthors(userIds: string[]): Promise<Map<string, HydratedAuthor>> {
  const result = new Map<string, HydratedAuthor>();
  if (userIds.length === 0) return result;

  const unique = Array.from(new Set(userIds));

  const [users, artists, venues] = await Promise.all([
    db
      .select({ id: user.id, name: user.name, image: user.image })
      .from(user)
      .where(inArray(user.id, unique)),
    db
      .select({
        userId: artistProfiles.userId,
        stageName: artistProfiles.stageName,
        profileImageUrl: artistProfiles.profileImageUrl,
      })
      .from(artistProfiles)
      .where(inArray(artistProfiles.userId, unique)),
    db
      .select({
        userId: venueProfiles.userId,
        venueName: venueProfiles.venueName,
        profileImageUrl: venueProfiles.profileImageUrl,
      })
      .from(venueProfiles)
      .where(inArray(venueProfiles.userId, unique)),
  ]);

  const artistByUserId = new Map(artists.map((a) => [a.userId, a]));
  const venueByUserId = new Map(venues.map((v) => [v.userId, v]));

  for (const u of users) {
    const artist = artistByUserId.get(u.id);
    const venue = venueByUserId.get(u.id);
    const displayName = artist?.stageName ?? venue?.venueName ?? u.name ?? 'Unknown';
    const profileImageUrl = artist?.profileImageUrl ?? venue?.profileImageUrl ?? u.image ?? null;
    const profileType: HydratedAuthor['profileType'] = artist ? 'artist' : venue ? 'venue' : 'user';
    result.set(u.id, { id: u.id, displayName, profileImageUrl, profileType });
  }

  return result;
}
