/**
 * Map demo seed — local Docker and Neon staging only.
 *
 * Inserts ~25 active events spread across Ireland so the map feature
 * has rich data to show during client demos. Relies on the main seed.ts
 * having already created the seed users (seed_artist, seed_venue).
 *
 * Run AFTER seed.ts:
 *   pnpm --filter @CeolX/db db:seed-map-demo
 *
 * NEVER run against production — the guard below will throw.
 */
import Typesense from 'typesense';

import { events } from './schema';
import type { NewEvent } from './schema/events';

import { db } from './index';
// Base date: "now" at runtime so events are always upcoming.
const now = new Date();
const days = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);
const hours = (date: Date, h: number) => new Date(date.getTime() + h * 60 * 60 * 1000);

async function seedMapDemo() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed must never run against production');
  }

  // All events created_by seed_artist or seed_venue — both are created by seed.ts.
  const ARTIST = 'seed_artist';
  const VENUE = 'seed_venue';

  const seedEvents: NewEvent[] = [
    // ── Dublin ──────────────────────────────────────────────────────────────
    {
      title: 'Trad Session at The Cobblestone',
      description:
        'Long-running Sunday afternoon session hosted by The Cobblestone in Smithfield. All instruments welcome. No PA, just the music.',
      dateStart: days(3),
      dateEnd: hours(days(3), 4),
      lat: '53.3497',
      lng: '-6.2784',
      venueAddress: 'The Cobblestone, Smithfield, Dublin 7',
      category: 'Jam Sessions',
      createdBy: ARTIST,
      status: 'active',
    },
    {
      title: 'Celtic Roots Concert — Vicar Street',
      description:
        'A full-band Celtic concert featuring uilleann pipes, fiddle, bodhrán, and low whistle. Ticketed event, doors at 19:30.',
      dateStart: days(5),
      dateEnd: hours(days(5), 3),
      lat: '53.3401',
      lng: '-6.2826',
      venueAddress: 'Vicar Street, Thomas St, Dublin 8',
      category: 'Festivals',
      ticketLink: 'https://www.ticketmaster.ie',
      createdBy: VENUE,
      status: 'active',
    },
    {
      title: 'Folk & Ballad Night — The Grand Social',
      description:
        "Dublin's favourite folk night returns. Singer-songwriters and ballad groups take the stage from 20:00. Free entry before 21:00.",
      dateStart: days(8),
      lat: '53.3468',
      lng: '-6.2595',
      venueAddress: 'The Grand Social, Lower Liffey St, Dublin 1',
      category: 'Gigs',
      createdBy: ARTIST,
      status: 'active',
    },
    {
      title: 'Contemporary Irish Music Showcase',
      description:
        'Emerging Irish artists blend traditional motifs with contemporary production. Showcasing the next generation of Irish music.',
      dateStart: days(12),
      lat: '53.3388',
      lng: '-6.2685',
      venueAddress: "Whelan's, Wexford St, Dublin 2",
      category: 'Karaoke',
      ticketLink: 'https://www.whelanslive.com',
      createdBy: ARTIST,
      status: 'active',
    },

    // ── Cork ────────────────────────────────────────────────────────────────
    {
      title: 'Rebel Songs — An Evening of Cork Ballads',
      description:
        'A night of Cork rebel ballads and traditional songs in the heart of Cork city. Performers TBC. Entry free, donations welcome.',
      dateStart: days(4),
      lat: '51.8979',
      lng: '-8.4719',
      venueAddress: 'Sin É, Coburg St, Cork',
      category: 'Gigs',
      createdBy: ARTIST,
      status: 'active',
    },
    {
      title: 'Celtic Fusion — The Roundy',
      description:
        "Cork's best fusion act mixes Celtic pipes and fiddle with jazz guitar and double bass. Standing room only — arrive early.",
      dateStart: days(9),
      lat: '51.9000',
      lng: '-8.4762',
      venueAddress: 'The Roundy, Castle St, Cork',
      category: 'Concerts',
      createdBy: VENUE,
      status: 'active',
    },
    {
      title: 'Traditional Session — Cork City',
      description:
        'Tuesday night trad session, open to all players. Sessions run from 21:00 and go late. No booking required.',
      dateStart: days(7),
      lat: '51.8969',
      lng: '-8.4630',
      venueAddress: 'An Spailpín Fánach, South Main St, Cork',
      category: 'Open Trad Sessions',
      createdBy: ARTIST,
      status: 'active',
    },

    // ── Galway ──────────────────────────────────────────────────────────────
    {
      title: 'Fleadh Sessions — Galway City',
      description:
        'Pre-Fleadh warm-up sessions across three Galway pubs on the same evening. Route map distributed at the door.',
      dateStart: days(6),
      dateEnd: hours(days(6), 5),
      lat: '53.2743',
      lng: '-9.0514',
      venueAddress: 'Tigh Coili, Mainguard St, Galway',
      category: 'Jam Sessions',
      createdBy: ARTIST,
      status: 'active',
    },
    {
      title: 'Connemara Sounds — Town Hall Theatre',
      description:
        'A curated evening celebrating the music of Connemara. Three acts, interval drinks included in ticket price.',
      dateStart: days(14),
      lat: '53.2718',
      lng: '-9.0534',
      venueAddress: 'Town Hall Theatre, Courthouse Sq, Galway',
      category: 'Open Trad Sessions',
      ticketLink: 'https://www.tht.ie',
      createdBy: VENUE,
      status: 'active',
    },
    {
      title: "Folk Night at Monroe's",
      description:
        "Weekly folk night at Monroe's Tavern. Performers change each week — you never know who might drop in.",
      dateStart: days(2),
      lat: '53.2733',
      lng: '-9.0499',
      venueAddress: "Monroe's Tavern, Dominick St, Galway",
      category: 'Gigs',
      createdBy: ARTIST,
      status: 'active',
    },

    // ── Limerick ────────────────────────────────────────────────────────────
    {
      title: 'Limerick Trad Weekend — Opening Night',
      description:
        "Kicking off the annual Limerick Trad Weekend with a ceili at Dolan's Warehouse. Beginners welcome.",
      dateStart: days(10),
      dateEnd: hours(days(10), 4),
      lat: '52.6638',
      lng: '-8.6267',
      venueAddress: "Dolan's Warehouse, Dock Rd, Limerick",
      category: 'Open Trad Sessions',
      ticketLink: 'https://dolans.ie',
      createdBy: VENUE,
      status: 'active',
    },
    {
      title: 'Celtic Cross Music Festival — Day 1',
      description:
        'Three stages, fifteen acts over two days celebrating Irish music across genres. Family-friendly, outdoor arena.',
      dateStart: days(18),
      dateEnd: hours(days(18), 8),
      lat: '52.6641',
      lng: '-8.6237',
      venueAddress: "King's Island, Limerick City",
      category: 'Festivals',
      createdBy: VENUE,
      status: 'active',
      isGigOpportunity: false,
    },

    // ── Kilkenny ─────────────────────────────────────────────────────────────
    {
      title: 'Kilkenny Roots — Outdoor Session',
      description:
        'As part of the Kilkenny Roots Festival fringe, this outdoor session fills the square with acoustic trad and folk music.',
      dateStart: days(11),
      lat: '52.6541',
      lng: '-7.2448',
      venueAddress: 'High St, Kilkenny City',
      category: 'Jam Sessions',
      createdBy: ARTIST,
      status: 'active',
    },

    // ── Sligo ────────────────────────────────────────────────────────────────
    {
      title: 'Under the Benbulben — A Yeats Night',
      description:
        'Music and spoken word celebrating the landscape that inspired W.B. Yeats. Traditional music, poems, and storytelling.',
      dateStart: days(13),
      lat: '54.2766',
      lng: '-8.4761',
      venueAddress: 'The Model, The Mall, Sligo',
      category: 'Open Trad Sessions',
      createdBy: ARTIST,
      status: 'active',
    },
    {
      title: "Sligo Trad Session — Hargadon's",
      description:
        "Intimate traditional session in one of Sligo's oldest pubs. Starts at 21:30, no cover charge.",
      dateStart: days(4),
      lat: '54.2758',
      lng: '-8.4769',
      venueAddress: "Hargadon's Bar, O'Connell St, Sligo",
      category: 'Jam Sessions',
      createdBy: ARTIST,
      status: 'active',
    },

    // ── Kerry ────────────────────────────────────────────────────────────────
    {
      title: 'Kerry Fiddle Festival — Tralee',
      description:
        'A celebration of the South Kerry fiddle tradition. Workshops during the day, concert in the evening.',
      dateStart: days(15),
      dateEnd: hours(days(15), 6),
      lat: '52.2704',
      lng: '-9.7020',
      venueAddress: 'Siamsa Tíre, Town Park, Tralee, Co. Kerry',
      category: 'Open Trad Sessions',
      ticketLink: 'https://www.siamsatire.com',
      createdBy: VENUE,
      status: 'active',
    },
    {
      title: 'Dingle Music Festival — Harbour Stage',
      description:
        'The harbour stage is back for summer. Sea air, traditional music, and the best fish chowder in Ireland.',
      dateStart: days(20),
      lat: '52.1409',
      lng: '-10.2700',
      venueAddress: 'Dingle Harbour, Dingle, Co. Kerry',
      category: 'Gigs',
      createdBy: ARTIST,
      status: 'active',
    },

    // ── Donegal ──────────────────────────────────────────────────────────────
    {
      title: 'Donegal Fiddle Tradition — An Evening with the Masters',
      description:
        'Celebrating the distinctive Donegal fiddle style. Three master fiddlers share the stage for one night only.',
      dateStart: days(16),
      lat: '54.6553',
      lng: '-8.1098',
      venueAddress: 'Regional Cultural Centre, Port Rd, Letterkenny, Co. Donegal',
      category: 'Open Trad Sessions',
      ticketLink: 'https://www.rcc.ie',
      createdBy: VENUE,
      status: 'active',
    },
    {
      title: 'Gaoth Dobhair Session — Teach Jack',
      description:
        'A rare session in the heart of the Donegal Gaeltacht. Irish language and music interwoven throughout the night.',
      dateStart: days(9),
      lat: '54.9700',
      lng: '-8.2783',
      venueAddress: 'Teach Jack, Gaoth Dobhair, Co. Donegal',
      category: 'Jam Sessions',
      createdBy: ARTIST,
      status: 'active',
    },

    // ── Westport ─────────────────────────────────────────────────────────────
    {
      title: 'Westport Trad Festival — Main Stage',
      description:
        'The flagship event of the Westport Trad Festival. Four acts over three hours in the town square.',
      dateStart: days(22),
      dateEnd: hours(days(22), 3),
      lat: '53.7960',
      lng: '-9.5179',
      venueAddress: 'Octagon, Westport, Co. Mayo',
      category: 'Open Trad Sessions',
      createdBy: VENUE,
      status: 'active',
    },

    // ── Waterford ────────────────────────────────────────────────────────────
    {
      title: 'Waterford Winterval — Trad Corner',
      description:
        'A cosy trad corner during Waterford Winterval. Hot drinks, good company, and traditional music all evening.',
      dateStart: days(17),
      lat: '52.2593',
      lng: '-7.1101',
      venueAddress: "Geoff's Bar, John St, Waterford",
      category: 'Jam Sessions',
      createdBy: ARTIST,
      status: 'active',
    },

    // ── Ennis ─────────────────────────────────────────────────────────────────
    {
      title: 'Ennis Trad Weekend — Opening Session',
      description:
        'Ennis is the traditional music capital of Clare. This opening session sets the tone for the weekend — arrive early.',
      dateStart: days(25),
      lat: '52.8439',
      lng: '-8.9806',
      venueAddress: "Brogan's Bar, O'Connell St, Ennis, Co. Clare",
      category: 'Open Trad Sessions',
      createdBy: ARTIST,
      status: 'active',
    },

    // ── Wexford ───────────────────────────────────────────────────────────────
    {
      title: 'Wexford Folk Weekend',
      description:
        'Two days of folk and ballad music across four Wexford Town venues. Wristband grants access to all stages.',
      dateStart: days(19),
      lat: '52.3369',
      lng: '-6.4573',
      venueAddress: 'Wexford Town Centre',
      category: 'Gigs',
      ticketLink: 'https://www.wexfordfolkweekend.ie',
      createdBy: VENUE,
      status: 'active',
    },

    // ── Gig Opportunity (visible to Artists only) ─────────────────────────────
    {
      title: 'Looking for Trad Musicians — Galway Pub Residency',
      description:
        'Well-established Galway pub seeks trad musicians for a 6-month Friday night residency starting in June. €200 per session, negotiable.',
      dateStart: days(30),
      lat: '53.2707',
      lng: '-9.0568',
      venueAddress: 'Tigh Neachtain, Cross St, Galway',
      category: 'Jam Sessions',
      createdBy: VENUE,
      status: 'active',
      isGigOpportunity: true,
    },
  ];

  const inserted = await db.insert(events).values(seedEvents).returning();

  // ── Sync to Typesense so getMap queries find the events ───────────────
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

  // Ensure collection exists
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
      { name: 'is_gig_opportunity', type: 'bool' as const },
      { name: 'status', type: 'string' as const },
    ],
    default_sorting_field: 'date_start',
  };

  try {
    await tsClient.collections('events').retrieve();
  } catch {
    await tsClient.collections().create(EVENTS_COLLECTION_SCHEMA);
  }

  // Upsert each event into Typesense
  const tsDocs = inserted.map((e) => ({
    id: e.id,
    title: e.title,
    category: e.category,
    location: [Number(e.lat), Number(e.lng)],
    date_start: Math.floor(e.dateStart.getTime() / 1000),
    date_end: e.dateEnd ? Math.floor(e.dateEnd.getTime() / 1000) : undefined,
    venue_address: e.venueAddress ?? undefined,
    cover_image: e.coverImage ?? undefined,
    is_gig_opportunity: e.isGigOpportunity ?? false,
    status: e.status ?? 'active',
  }));

  await tsClient.collections('events').documents().import(tsDocs, { action: 'upsert' });

  console.warn(`Map demo seed complete: ${inserted.length} events inserted into DB + Typesense`);
  process.exit(0);
}

seedMapDemo().catch((err: unknown) => {
  console.error('Map demo seed failed:', err);
  process.exit(1);
});
