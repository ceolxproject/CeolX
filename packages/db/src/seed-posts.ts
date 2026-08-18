/**
 * Posts feed seed — local Docker only. Throwaway local data, not meant to ship.
 *
 * Inserts ~14 text posts by the seed artist/venue so the Discover → Posts tab
 * has enough content to scroll (and to test the collapsing header there too).
 * The Posts feed reads straight from Postgres (no Typesense), newest first,
 * hiding deleted posts — so plain inserts are all that's needed.
 *
 * Run directly (no package.json script — this is throwaway):
 *   pnpm --filter @CeolX/db exec tsx --env-file ../../apps/server/.env src/seed-posts.ts
 */
import { eq } from 'drizzle-orm';

import { artistProfiles, posts, venueProfiles } from './schema';
import { user } from './schema/auth';
import type { NewPost } from './schema/social';

import { db } from './index';

const now = new Date();
const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000);

const ARTIST = 'seed_artist';
const VENUE = 'seed_venue';

// Hard local-only guard — this .env carries NODE_ENV=staging, so assert the
// actual DB target is localhost before writing.
function assertLocalDb() {
  const dbUrl = process.env.DATABASE_URL ?? '';
  if (!/@(localhost|127\.0\.0\.1)(:\d+)?\//.test(dbUrl)) {
    throw new Error('Refusing to seed — DATABASE_URL is not localhost/127.0.0.1.');
  }
}

// caption, author, hours-ago, likeCount
const POSTS: [string, string, number, number][] = [
  [
    'Sunday session at Tigh Coili was something else. Packed house, three fiddles, and a bodhrán that could wake the dead. 🎻',
    ARTIST,
    1,
    34,
  ],
  [
    'New set list ready for the Fleadh warm-up this week. Half trad, half original. Come say hello.',
    ARTIST,
    3,
    12,
  ],
  [
    'Doors open 8pm tonight. Trad & ceol upstairs, no cover before 9. See you at the bar. 🍺',
    VENUE,
    5,
    8,
  ],
  [
    'Recorded a rough demo of a new reel this morning. Working title: "The Corrib Turn". Feedback welcome.',
    ARTIST,
    9,
    21,
  ],
  [
    "Big thanks to everyone who turned out last night — best crowd we've had all summer. ☘️",
    VENUE,
    14,
    45,
  ],
  ['Looking for a box player for a few Friday residencies. DM if interested.', VENUE, 20, 6],
  [
    'That moment when the whole room joins in for the last chorus. Nothing like it.',
    ARTIST,
    26,
    30,
  ],
  ['Restrung, retuned, and ready. Two gigs this weekend either side of the city.', ARTIST, 33, 9],
  ['Live music every night this week. Full line-up on the board by the door.', VENUE, 41, 15],
  [
    'First time playing the Town Hall stage. Nerves gone the second we started. What a night.',
    ARTIST,
    50,
    52,
  ],
  ['Quiet one tonight — perfect for a slow air or two. Bring your instrument.', VENUE, 61, 4],
  [
    'Throwback to the harbour session last month. Sea air and slip jigs. Bring it back please. 🌊',
    ARTIST,
    74,
    27,
  ],
  ["We've added a second date — same line-up, tickets on the wall. Grab one early.", VENUE, 90, 11],
  [
    'Late finish, early start, worth every minute. Galway, you were class this week. 🎶',
    ARTIST,
    110,
    38,
  ],
];

async function seedPosts() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed must never run against production');
  }
  assertLocalDb();

  // Self-bootstrap the two authors so this works from any local state.
  await db
    .insert(user)
    .values([
      {
        id: ARTIST,
        email: 'artist@ceolx.test',
        name: 'Test Artist',
        emailVerified: true,
        currentRole: 'artist',
        consentAt: now,
      },
      {
        id: VENUE,
        email: 'venue@ceolx.test',
        name: 'Test Venue',
        emailVerified: true,
        currentRole: 'venue',
        consentAt: now,
      },
    ])
    .onConflictDoNothing();

  const [existingArtist] = await db
    .select({ id: artistProfiles.id })
    .from(artistProfiles)
    .where(eq(artistProfiles.userId, ARTIST))
    .limit(1);
  if (!existingArtist) {
    await db.insert(artistProfiles).values({
      userId: ARTIST,
      stageName: 'The Test Fiddler',
      genre: 'Traditional',
      isActive: true,
    });
  }

  const [existingVenue] = await db
    .select({ id: venueProfiles.id })
    .from(venueProfiles)
    .where(eq(venueProfiles.userId, VENUE))
    .limit(1);
  if (!existingVenue) {
    await db.insert(venueProfiles).values({
      userId: VENUE,
      venueName: 'The Test Pub',
      address: '123 Main St, Dublin, D01 AB12',
      // Seeded mid-trial rather than inactive: a trialing venue is the realistic
      // launch state and is publicly visible (M8-T0 D-28), so local dev exercises
      // the visible path once VENUE_GATE_ENABLED is switched on.
      subscriptionStatus: 'trialing',
    });
  }

  const rows: NewPost[] = POSTS.map(([caption, createdBy, h, likeCount]) => ({
    createdBy,
    caption,
    mediaType: 'text',
    likeCount,
    createdAt: hoursAgo(h),
    updatedAt: hoursAgo(h),
  }));

  const inserted = await db.insert(posts).values(rows).returning({ id: posts.id });
  console.warn(`Posts seed complete: ${inserted.length} text posts inserted`);
  process.exit(0);
}

seedPosts().catch((err: unknown) => {
  console.error('Posts seed failed:', err);
  process.exit(1);
});
