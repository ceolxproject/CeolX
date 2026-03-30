/**
 * Seed script — local Docker and Neon staging only.
 * Inserts minimal data for manual testing during M2 (Authentication) development.
 *
 * Run: DATABASE_URL=... pnpm --filter @CeolX/db db:seed
 *
 * NEVER run against production — the guard below will throw.
 *
 * @remarks
 * eslint-disable below suppresses no-unsafe-assignment / no-unsafe-member-access
 * for Drizzle's .returning() generic which doesn't resolve in ESLint's type-checker.
 * tsc --noEmit is clean; this is a dev-only script.
 */

import { artistProfiles, events, users, venueProfiles } from './schema';

import { db } from './index';

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed must never run against production');
  }

  const now = new Date();
  const consentAt = now;

  // -------------------------------------------------------------------------
  // Users — one per persona
  // -------------------------------------------------------------------------
  await db.insert(users).values({
    email: 'spectator@ceolx.test',
    name: 'Test Spectator',
    currentRole: 'spectator',
    consentAt,
  });

  const [artist] = await db
    .insert(users)
    .values({
      email: 'artist@ceolx.test',
      name: 'Test Artist',
      currentRole: 'artist',
      consentAt,
    })
    .returning();

  const [venue] = await db
    .insert(users)
    .values({
      email: 'venue@ceolx.test',
      name: 'Test Venue',
      currentRole: 'venue',
      consentAt,
    })
    .returning();

  await db.insert(users).values({
    email: 'admin@ceolx.test',
    name: 'Super Admin',
    currentRole: 'super_admin',
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
      subscriptionStatus: 'inactive',
      isActive: false,
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
      category: 'Traditional',
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
      category: 'Folk',
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
      category: 'Fusion',
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
