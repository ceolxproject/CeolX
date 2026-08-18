/**
 * Seed script — local Docker and Neon staging only.
 * Inserts minimal data for manual testing during M2 (Authentication) development.
 *
 * Run: DATABASE_URL=... pnpm --filter @CeolX/db db:seed
 *
 * NEVER run against production — the guard below will throw.
 */

import { artistProfiles, events, venueProfiles } from './schema';
import { user } from './schema/auth';

import { db } from './index';

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed must never run against production');
  }

  const now = new Date();
  const consentAt = now;

  // -------------------------------------------------------------------------
  // Users — one per persona, inserted directly into BetterAuth's user table.
  // BetterAuth IDs are text; we use short readable strings for dev convenience.
  // -------------------------------------------------------------------------
  await db.insert(user).values({
    id: 'seed_spectator',
    email: 'spectator@ceolx.test',
    name: 'Test Spectator',
    emailVerified: true,
    currentRole: 'spectator',
    consentAt,
  });

  const [artist] = await db
    .insert(user)
    .values({
      id: 'seed_artist',
      email: 'artist@ceolx.test',
      name: 'Test Artist',
      emailVerified: true,
      currentRole: 'artist',
      consentAt,
    })
    .returning();

  const [venue] = await db
    .insert(user)
    .values({
      id: 'seed_venue',
      email: 'venue@ceolx.test',
      name: 'Test Venue',
      emailVerified: true,
      currentRole: 'venue',
      consentAt,
    })
    .returning();

  await db.insert(user).values({
    id: 'seed_admin',
    email: 'admin@ceolx.test',
    name: 'Super Admin',
    emailVerified: true,
    currentRole: 'admin',
    consentAt,
  });

  if (!artist || !venue) {
    throw new Error('Failed to insert seed users');
  }

  // -------------------------------------------------------------------------
  // Profiles
  // -------------------------------------------------------------------------
  await db.insert(artistProfiles).values({
    userId: artist.id,
    stageName: 'The Test Fiddler',
    genre: 'Traditional',
    isActive: true,
  });

  const [venueProfile] = await db
    .insert(venueProfiles)
    .values({
      userId: venue.id,
      venueName: 'The Test Pub',
      address: '123 Main St, Dublin, D01 AB12',
      // Seeded mid-trial rather than inactive: a trialing venue is the realistic
      // launch state and is publicly visible (M8-T0 D-28), so local dev exercises
      // the visible path once VENUE_GATE_ENABLED is switched on.
      subscriptionStatus: 'trialing',
    })
    .returning();

  if (!venueProfile) {
    throw new Error('Failed to insert seed venue profile');
  }

  // -------------------------------------------------------------------------
  // Events — active (map), pending (moderation queue), rejected
  // -------------------------------------------------------------------------
  await db.insert(events).values([
    {
      title: 'Trad Session — Galway',
      description: 'Traditional Irish music session every Friday.',
      dateStart: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      lat: '53.2707',
      lng: '-9.0568',
      venueId: venueProfile.id,
      venueAddress: 'The Test Pub, Galway',
      category: 'Open Trad Sessions',
      createdBy: venue.id,
      status: 'active',
    },
    {
      title: 'Folk Night — Dublin',
      description: 'Acoustic folk performances in the heart of Dublin.',
      dateStart: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      lat: '53.3498',
      lng: '-6.2603',
      venueAddress: 'The Grand Social, Dublin',
      category: 'Gigs',
      createdBy: artist.id,
      status: 'pending_review',
    },
    {
      title: 'Celtic Fusion — Cork',
      description: 'Experimental fusion of Celtic and contemporary sounds.',
      dateStart: new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000),
      lat: '51.8985',
      lng: '-8.4756',
      venueAddress: 'The Roundy, Cork',
      category: 'Concerts',
      createdBy: artist.id,
      status: 'rejected',
      rejectionReason: 'Insufficient event description provided.',
    },
  ]);

  console.warn('Seed complete: 4 users, 1 artist profile, 1 venue profile, 3 events');

  process.exit(0);
}

seed().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
