/**
 * Galway feed seed — local Docker and Neon staging only.
 *
 * Inserts ~18 active, upcoming events clustered in and around Galway city so the
 * Discover feed has enough content to scroll (handy for testing the collapsing
 * header). Set the app's location to Galway (53.2707, -9.0568) and every event
 * here falls inside the feed's 100 km radius.
 *
 * Relies on seed.ts having created the seed users (seed_artist, seed_venue) and
 * their profiles. Run AFTER seed.ts:
 *   pnpm --filter @CeolX/db db:seed-galway
 *
 * Syncs to Typesense with the SAME document shape the app expects — see
 * packages/api/src/services/event-sync.ts (toTypesenseDoc) and
 * packages/api/src/lib/typesense.ts (EVENTS_COLLECTION_SCHEMA). The feed reads
 * from Typesense, not Postgres, so a doc missing e.g. created_at breaks it.
 *
 * NEVER run against production — the guard below will throw.
 * ponytail: re-running appends more events (fine for scroll testing); to reset,
 * re-seed the local DB from scratch.
 */
import { eq } from 'drizzle-orm';
import Typesense from 'typesense';

import { artistProfiles, events, venueProfiles } from './schema';
import { user } from './schema/auth';
import type { NewEvent } from './schema/events';

import { db } from './index';

// Base date: "now" at runtime so events are always upcoming.
const now = new Date();
const days = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);
const hours = (date: Date, h: number) => new Date(date.getTime() + h * 60 * 60 * 1000);

const ARTIST = 'seed_artist';
const VENUE = 'seed_venue';

// Galway city + county venues, coordinates clustered around the city centre
// (53.2707, -9.0568). A spread of categories so the feed's category filter has
// something to bite on too.
const GALWAY_EVENTS: NewEvent[] = [
  {
    title: 'Trad Session — Tigh Coili',
    description:
      'Twice-daily sessions with some of Galway’s finest trad players. Arrive early for a seat.',
    dateStart: days(1),
    dateEnd: hours(days(1), 3),
    lat: '53.2719',
    lng: '-9.0533',
    venueAddress: 'Tigh Coili, Mainguard St, Galway',
    category: 'Open Trad Sessions',
    createdBy: ARTIST,
    status: 'active',
  },
  {
    title: 'Folk Night at Monroe’s',
    description:
      'Weekly folk night at Monroe’s Tavern. Performers change each week — you never know who’ll drop in.',
    dateStart: days(2),
    lat: '53.2733',
    lng: '-9.0499',
    venueAddress: 'Monroe’s Tavern, Dominick St, Galway',
    category: 'Gigs',
    createdBy: ARTIST,
    status: 'active',
  },
  {
    title: 'The Crane Bar — Upstairs Session',
    description: 'Intimate upstairs trad session in the West End. No PA, just the tunes.',
    dateStart: days(2),
    dateEnd: hours(days(2), 4),
    lat: '53.2701',
    lng: '-9.0611',
    venueAddress: 'The Crane Bar, Sea Rd, Galway',
    category: 'Jam Sessions',
    createdBy: VENUE,
    status: 'active',
  },
  {
    title: 'Róisín Dubh — Trad & Ceol',
    description:
      'A full-band Celtic set featuring fiddle, bodhrán and uilleann pipes. Doors 20:00.',
    dateStart: days(3),
    dateEnd: hours(days(3), 3),
    lat: '53.2728',
    lng: '-9.0524',
    venueAddress: 'Róisín Dubh, Dominick St, Galway',
    category: 'Concerts',
    ticketLink: 'https://www.roisindubh.net',
    createdBy: VENUE,
    status: 'active',
  },
  {
    title: 'Taaffes Bar — Afternoon Session',
    description: 'Daily afternoon session on Shop Street. A Galway institution.',
    dateStart: days(3),
    lat: '53.2723',
    lng: '-9.0531',
    venueAddress: 'Taaffes Bar, Shop St, Galway',
    category: 'Open Trad Sessions',
    createdBy: ARTIST,
    status: 'active',
  },
  {
    title: 'The Quays — Live Ballads',
    description: 'Ballads and singalongs in the famous Quay Street bar. Free entry.',
    dateStart: days(4),
    lat: '53.2712',
    lng: '-9.0545',
    venueAddress: 'The Quays, Quay St, Galway',
    category: 'Gigs',
    createdBy: VENUE,
    status: 'active',
  },
  {
    title: 'Connemara Sounds — Town Hall Theatre',
    description:
      'A curated evening celebrating the music of Connemara. Three acts, interval drinks included.',
    dateStart: days(5),
    lat: '53.2718',
    lng: '-9.0534',
    venueAddress: 'Town Hall Theatre, Courthouse Sq, Galway',
    category: 'Concerts',
    ticketLink: 'https://www.tht.ie',
    createdBy: VENUE,
    status: 'active',
  },
  {
    title: 'Tigh Neachtain — Corner Session',
    description: 'The famous blue corner pub hosts a cosy session in the snug. Squeeze in.',
    dateStart: days(5),
    dateEnd: hours(days(5), 3),
    lat: '53.2707',
    lng: '-9.0553',
    venueAddress: 'Tigh Neachtain, Cross St, Galway',
    category: 'Jam Sessions',
    createdBy: ARTIST,
    status: 'active',
  },
  {
    title: 'An Púcán — Trad & Craic',
    description: 'Nightly music near Eyre Square. High energy, late finish.',
    dateStart: days(6),
    lat: '53.2743',
    lng: '-9.0472',
    venueAddress: 'An Púcán, Forster St, Galway',
    category: 'Gigs',
    createdBy: VENUE,
    status: 'active',
  },
  {
    title: 'Fleadh Warm-Up — City Sessions',
    description:
      'Pre-Fleadh warm-up sessions across three Galway pubs on the same evening. Route map at the door.',
    dateStart: days(7),
    dateEnd: hours(days(7), 5),
    lat: '53.2731',
    lng: '-9.0514',
    venueAddress: 'Mainguard St, Galway',
    category: 'Festivals',
    createdBy: ARTIST,
    status: 'active',
  },
  {
    title: 'The Salt House — Session by the Weir',
    description: 'Craft-beer bar session overlooking the Corrib. Acoustic only.',
    dateStart: days(8),
    lat: '53.2716',
    lng: '-9.0576',
    venueAddress: 'The Salt House, Raven Terrace, Galway',
    category: 'Open Trad Sessions',
    createdBy: VENUE,
    status: 'active',
  },
  {
    title: 'Sally Long’s — Rock & Trad',
    description: 'Where trad meets rock — a Galway late-night staple on Abbeygate Street.',
    dateStart: days(9),
    lat: '53.2735',
    lng: '-9.0528',
    venueAddress: 'Sally Long’s, Upper Abbeygate St, Galway',
    category: 'Gigs',
    createdBy: ARTIST,
    status: 'active',
  },
  {
    title: 'Massimo — West End Session',
    description: 'West End favourite with a lively weekend session. Big crowd, great sound.',
    dateStart: days(10),
    dateEnd: hours(days(10), 3),
    lat: '53.2705',
    lng: '-9.0602',
    venueAddress: 'Massimo, William St West, Galway',
    category: 'Jam Sessions',
    createdBy: VENUE,
    status: 'active',
  },
  {
    title: 'The King’s Head — Ballad Night',
    description:
      'Historic High Street venue hosts a night of Irish ballads. Three floors of music.',
    dateStart: days(11),
    lat: '53.2721',
    lng: '-9.0539',
    venueAddress: 'The King’s Head, High St, Galway',
    category: 'Karaoke',
    createdBy: VENUE,
    status: 'active',
  },
  {
    title: 'Salthill Prom — Sunset Session',
    description: 'Outdoor acoustic session along the Salthill promenade. Weather permitting.',
    dateStart: days(12),
    lat: '53.2610',
    lng: '-9.0700',
    venueAddress: 'Salthill Promenade, Galway',
    category: 'Gigs',
    createdBy: ARTIST,
    status: 'active',
  },
  {
    title: 'Oughterard Trad Weekend',
    description: 'A weekend of sessions in the gateway to Connemara. Beginners welcome.',
    dateStart: days(14),
    dateEnd: hours(days(14), 6),
    lat: '53.4256',
    lng: '-9.3230',
    venueAddress: 'Main St, Oughterard, Co. Galway',
    category: 'Festivals',
    createdBy: VENUE,
    status: 'active',
  },
  {
    title: 'Athenry Sessions — Medieval Town',
    description: 'Trad in the shadow of Athenry Castle. A short hop east of the city.',
    dateStart: days(16),
    lat: '53.2986',
    lng: '-8.7450',
    venueAddress: 'Cross St, Athenry, Co. Galway',
    category: 'Open Trad Sessions',
    createdBy: ARTIST,
    status: 'active',
  },
  {
    title: 'Clifden Trad Festival — Opening Night',
    description:
      'Kicking off the Clifden trad weekend in the heart of Connemara. Sessions across the town.',
    dateStart: days(18),
    dateEnd: hours(days(18), 4),
    lat: '53.4886',
    lng: '-10.0203',
    venueAddress: 'Market St, Clifden, Co. Galway',
    category: 'Festivals',
    ticketLink: 'https://clifdentradfest.ie',
    createdBy: VENUE,
    status: 'active',
  },
];

// Events collection schema — MUST match packages/api/src/lib/typesense.ts.
const EVENTS_COLLECTION_SCHEMA = {
  name: 'events',
  fields: [
    { name: 'id', type: 'string' as const },
    { name: 'title', type: 'string' as const },
    { name: 'category', type: 'string' as const, facet: true },
    { name: 'location', type: 'geopoint' as const },
    { name: 'date_start', type: 'int64' as const },
    { name: 'date_end', type: 'int64' as const, optional: true },
    { name: 'venue_address', type: 'string' as const, optional: true },
    { name: 'cover_image', type: 'string' as const, optional: true },
    { name: 'status', type: 'string' as const },
    { name: 'creator_id', type: 'string' as const },
    { name: 'creator_name', type: 'string' as const },
    { name: 'created_at', type: 'int64' as const },
    { name: 'joined_count', type: 'int32' as const },
  ],
  default_sorting_field: 'date_start',
};

// Hard local-only guard. This .env carries NODE_ENV=staging and staging URLs for
// other services, so NODE_ENV alone is not enough — assert the actual DB and
// Typesense targets are localhost before writing a single row.
function assertLocalTarget() {
  const dbUrl = process.env.DATABASE_URL ?? '';
  const tsHost = process.env.TYPESENSE_HOST ?? '';
  const dbIsLocal = /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(dbUrl);
  const tsIsLocal = /^(localhost|127\.0\.0\.1)$/.test(tsHost);
  if (!dbIsLocal || !tsIsLocal) {
    throw new Error(
      `Refusing to seed — target is not local.\n` +
        `  DB host local:        ${dbIsLocal}\n` +
        `  Typesense host local: ${tsIsLocal} (TYPESENSE_HOST="${tsHost}")\n` +
        `Both DATABASE_URL and TYPESENSE_HOST must point at localhost/127.0.0.1.`
    );
  }
}

async function seedGalway() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed must never run against production');
  }
  assertLocalTarget();

  // Self-bootstrap the two creator accounts so this seed works from any local
  // state (fresh, partial, or fully seeded). Mirrors packages/db/src/seed.ts.
  // Events FK to user.id only; the profiles just supply the feed's creator_name.
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

  // Use an existing profile's name if present (stay consistent with enrichEvent);
  // otherwise create the profile with the standard seed values.
  const [existingArtist] = await db
    .select({ stageName: artistProfiles.stageName })
    .from(artistProfiles)
    .where(eq(artistProfiles.userId, ARTIST))
    .limit(1);
  let artistStageName = existingArtist?.stageName;
  if (!artistStageName) {
    artistStageName = 'The Test Fiddler';
    await db
      .insert(artistProfiles)
      .values({ userId: ARTIST, stageName: artistStageName, genre: 'Traditional', isActive: true });
  }

  const [existingVenue] = await db
    .select({ venueName: venueProfiles.venueName })
    .from(venueProfiles)
    .where(eq(venueProfiles.userId, VENUE))
    .limit(1);
  let venueName = existingVenue?.venueName;
  if (!venueName) {
    venueName = 'The Test Pub';
    await db.insert(venueProfiles).values({
      userId: VENUE,
      venueName,
      address: '123 Main St, Dublin, D01 AB12',
      // Seeded mid-trial rather than inactive: a trialing venue is the realistic
      // launch state and is publicly visible (M8-T0 D-28), so local dev exercises
      // the visible path once VENUE_GATE_ENABLED is switched on.
      subscriptionStatus: 'trialing',
    });
  }

  const creatorName: Record<string, string> = {
    [ARTIST]: artistStageName,
    [VENUE]: venueName,
  };

  const inserted = await db.insert(events).values(GALWAY_EVENTS).returning();

  const tsClient = new Typesense.Client({
    nodes: [
      {
        host: process.env.TYPESENSE_HOST ?? 'localhost',
        port: Number(process.env.TYPESENSE_PORT ?? 8108),
        protocol: process.env.TYPESENSE_PROTOCOL ?? 'http',
      },
    ],
    apiKey: process.env.TYPESENSE_API_KEY ?? 'dev-local-key',
    connectionTimeoutSeconds: 5,
  });

  try {
    await tsClient.collections('events').retrieve();
  } catch {
    await tsClient.collections().create(EVENTS_COLLECTION_SCHEMA);
  }

  const tsDocs = inserted.map((e) => ({
    id: e.id,
    title: e.title,
    category: e.category,
    location: [Number(e.lat), Number(e.lng)] as [number, number],
    date_start: Math.floor(e.dateStart.getTime() / 1000),
    date_end: e.dateEnd ? Math.floor(e.dateEnd.getTime() / 1000) : undefined,
    venue_address: e.venueAddress ?? undefined,
    cover_image: e.coverImage ?? undefined,
    status: e.status ?? 'active',
    creator_id: e.createdBy,
    creator_name: creatorName[e.createdBy] ?? 'Unknown',
    created_at: Math.floor(e.createdAt.getTime() / 1000),
    joined_count: 0,
  }));

  await tsClient.collections('events').documents().import(tsDocs, { action: 'upsert' });

  console.warn(`Galway seed complete: ${inserted.length} events inserted into DB + Typesense`);
  process.exit(0);
}

seedGalway().catch((err: unknown) => {
  console.error('Galway seed failed:', err);
  process.exit(1);
});
