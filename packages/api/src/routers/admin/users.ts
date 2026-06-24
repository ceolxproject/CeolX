import { TRPCError } from '@trpc/server';
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gt,
  gte,
  ilike,
  inArray,
  lte,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { account, session, user } from '@CeolX/db/schema/auth';
import { bookings, venueSubscriptions } from '@CeolX/db/schema/bookings';
import { events, savedEvents } from '@CeolX/db/schema/events';
import { deviceTokens } from '@CeolX/db/schema/notifications';
import { follows, posts } from '@CeolX/db/schema/social';
import { artistProfiles, profileSocialLinks, venueProfiles } from '@CeolX/db/schema/users';
import type { AuthMethod, UserPersonaFilter } from '@CeolX/shared/validators';
import {
  adminUserDetailInputSchema,
  adminUsersExportInputSchema,
  adminUsersListInputSchema,
} from '@CeolX/shared/validators';

import { adminProcedure, router } from '../../index';
import {
  EXPORT_MAX_ROWS,
  computePagination,
  osFromUserAgent,
  shapeRichUserRow,
  shapeUserRow,
  toIso,
} from '../../lib/admin-users';

const SORT_COLUMNS = {
  name: user.name,
  email: user.email,
  createdAt: user.createdAt,
  lastLoginAt: user.lastLoginAt,
} as const;

const NON_ADMIN = ne(user.currentRole, 'admin');

// Filter fields shared by list + exportAll (everything except paging/sorting).
type UserFilterInput = {
  search?: string;
  persona?: UserPersonaFilter[];
  authMethod?: AuthMethod[];
  emailVerified?: boolean;
  flaggedInactive?: boolean;
  marketingConsent?: boolean;
  registeredFrom?: string;
  registeredTo?: string;
};

function endOfDay(date: string): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

// Builds the WHERE clause from the filter inputs. subscriptionStatus + authMethod
function buildUserFilter(input: UserFilterInput): SQL {
  const conds: Array<SQL | undefined> = [NON_ADMIN];

  if (input.search) {
    conds.push(or(ilike(user.name, `%${input.search}%`), ilike(user.email, `%${input.search}%`)));
  }
  if (input.persona?.length) conds.push(inArray(user.currentRole, input.persona));
  if (input.emailVerified !== undefined) conds.push(eq(user.emailVerified, input.emailVerified));
  if (input.flaggedInactive !== undefined)
    conds.push(eq(user.flaggedInactive, input.flaggedInactive));
  if (input.marketingConsent !== undefined)
    conds.push(eq(user.marketingConsent, input.marketingConsent));
  if (input.registeredFrom) conds.push(gte(user.createdAt, new Date(input.registeredFrom)));
  if (input.registeredTo) conds.push(lte(user.createdAt, endOfDay(input.registeredTo)));

  if (input.authMethod?.length) {
    conds.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(account)
          .where(and(eq(account.userId, user.id), inArray(account.providerId, input.authMethod)))
      )
    );
  }

  return and(...conds) as SQL;
}

// Events-count + auth-providers run as correlated subqueries, per page row (limit 20).
// Fine under the launch cap; revisit with a join + groupBy if the table grows.
const RICH_SELECT = {
  id: user.id,
  name: user.name,
  email: user.email,
  currentRole: user.currentRole,
  lastLoginAt: user.lastLoginAt,
  flaggedInactive: user.flaggedInactive,
  emailVerified: user.emailVerified,
  image: user.image,
  venueSubscriptionStatus: venueProfiles.subscriptionStatus,
  artistActive: artistProfiles.isActive,
  // Uploaded artist/venue photo (CDN). The BetterAuth `user.image` is only set by
  // social login, so without this an artist who uploaded a photo still shows initials.
  profileImageUrl: sql<
    string | null
  >`coalesce(${artistProfiles.profileImageUrl}, ${venueProfiles.profileImageUrl})`,
  eventsCount: sql<number>`(select count(*)::int from ${events} where ${events.createdBy} = ${user.id})`,
  authProviders: sql<
    string[]
  >`coalesce((select array_agg(distinct ${account.providerId}) from ${account} where ${account.userId} = ${user.id}), '{}')`,
};

const list = adminProcedure.input(adminUsersListInputSchema).query(async ({ input }) => {
  const filter = buildUserFilter(input);
  const orderColumn = SORT_COLUMNS[input.sortBy];
  const orderFn = input.sortDir === 'asc' ? asc : desc;

  const [rows, totalRow] = await Promise.all([
    db
      .select(RICH_SELECT)
      .from(user)
      .leftJoin(artistProfiles, eq(artistProfiles.userId, user.id))
      .leftJoin(venueProfiles, eq(venueProfiles.userId, user.id))
      .where(filter)
      .orderBy(orderFn(orderColumn))
      .limit(input.limit)
      .offset((input.page - 1) * input.limit),
    db.select({ count: count() }).from(user).where(filter),
  ]);

  const total = totalRow[0]?.count ?? 0;

  return {
    users: rows.map(shapeRichUserRow),
    pagination: computePagination({ total, page: input.page, limit: input.limit }),
  };
});

const exportAll = adminProcedure.input(adminUsersExportInputSchema).query(async ({ input }) => {
  const filter = buildUserFilter(input);
  const orderColumn = SORT_COLUMNS[input.sortBy];
  const orderFn = input.sortDir === 'asc' ? asc : desc;

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      currentRole: user.currentRole,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      flaggedInactive: user.flaggedInactive,
    })
    .from(user)
    .where(filter)
    .orderBy(orderFn(orderColumn))
    .limit(EXPORT_MAX_ROWS);

  return {
    users: rows.map((r) => shapeUserRow({ ...r, flaggedInactive: r.flaggedInactive ?? false })),
    cap: EXPORT_MAX_ROWS,
  };
});

// Full per-user metadata for the detail drawer. Single-user fetch — heavier joins
// and parallel counts are acceptable here (not on the list).
const getById = adminProcedure.input(adminUserDetailInputSchema).query(async ({ input }) => {
  const { userId } = input;

  const [u] = await db.select().from(user).where(eq(user.id, userId)).limit(1);
  if (!u) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });

  const [artistRows, venueRows, socialLinks, accounts, sessions, activeSessionRows, devices] =
    await Promise.all([
      db.select().from(artistProfiles).where(eq(artistProfiles.userId, userId)).limit(1),
      db.select().from(venueProfiles).where(eq(venueProfiles.userId, userId)).limit(1),
      db
        .select({ platform: profileSocialLinks.platform, url: profileSocialLinks.url })
        .from(profileSocialLinks)
        .where(eq(profileSocialLinks.userId, userId)),
      db
        .select({ providerId: account.providerId, password: account.password })
        .from(account)
        .where(eq(account.userId, userId)),
      db
        .select({
          ipAddress: session.ipAddress,
          userAgent: session.userAgent,
          createdAt: session.createdAt,
        })
        .from(session)
        .where(eq(session.userId, userId))
        .orderBy(desc(session.createdAt))
        .limit(1),
      db
        .select({ count: count() })
        .from(session)
        .where(and(eq(session.userId, userId), gt(session.expiresAt, new Date()))),
      db
        .select({
          platform: deviceTokens.platform,
          isActive: deviceTokens.isActive,
          lastUsedAt: deviceTokens.lastUsedAt,
        })
        .from(deviceTokens)
        .where(eq(deviceTokens.userId, userId)),
    ]);

  const artist = artistRows[0] ?? null;
  const venue = venueRows[0] ?? null;

  const venueSub = venue
    ? ((
        await db
          .select({
            plan: venueSubscriptions.plan,
            status: venueSubscriptions.status,
            currentPeriodEnd: venueSubscriptions.currentPeriodEnd,
          })
          .from(venueSubscriptions)
          .where(eq(venueSubscriptions.venueId, venue.id))
          .limit(1)
      )[0] ?? null)
    : null;

  const [c] = await db
    .select({
      events: sql<number>`(select count(*)::int from ${events} where ${events.createdBy} = ${userId})`,
      saved: sql<number>`(select count(*)::int from ${savedEvents} where ${savedEvents.userId} = ${userId})`,
      followers: sql<number>`(select count(*)::int from ${follows} where ${follows.followeeId} = ${userId})`,
      following: sql<number>`(select count(*)::int from ${follows} where ${follows.followerId} = ${userId})`,
      posts: sql<number>`(select count(*)::int from ${posts} where ${posts.createdBy} = ${userId} and ${posts.deletedAt} is null)`,
      // Artist bookings, split by who started it. "Requested" = this artist
      // applied to a venue gig, or invited a co-artist. "Invited" = this artist
      // was asked to perform (by a venue, or by another artist).
      artistRequested: sql<number>`(select count(*)::int from ${bookings} where (${bookings.artistId} = ${artist?.id ?? null} and ${bookings.direction} = 'artist_to_venue') or ${bookings.inviterArtistId} = ${artist?.id ?? null})`,
      artistInvited: sql<number>`(select count(*)::int from ${bookings} where ${bookings.artistId} = ${artist?.id ?? null} and ${bookings.direction} in ('venue_to_artist', 'artist_to_artist'))`,
      // Venue bookings. "Sent" = invites this venue sent to artists. "Received"
      // = applications artists sent to this venue.
      venueSent: sql<number>`(select count(*)::int from ${bookings} where ${bookings.venueId} = ${venue?.id ?? null} and ${bookings.direction} = 'venue_to_artist')`,
      venueReceived: sql<number>`(select count(*)::int from ${bookings} where ${bookings.venueId} = ${venue?.id ?? null} and ${bookings.direction} = 'artist_to_venue')`,
    })
    .from(user)
    .where(eq(user.id, userId));

  // Recent events this user created — the inline list in the detail sheet.
  // `counts.events` carries the true total for the "View all" link.
  const recentEvents = await db
    .select({
      id: events.id,
      title: events.title,
      dateStart: events.dateStart,
      status: events.status,
    })
    .from(events)
    .where(eq(events.createdBy, userId))
    .orderBy(desc(events.dateStart))
    .limit(6);

  const lastSession = sessions[0] ?? null;

  return {
    user: {
      id: u.id,
      name: u.name,
      email: u.email,
      image: u.image,
      currentRole: u.currentRole,
      emailVerified: u.emailVerified,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
      lastLoginAt: toIso(u.lastLoginAt),
      consentAt: toIso(u.consentAt),
      marketingConsent: u.marketingConsent ?? false,
      flaggedInactive: u.flaggedInactive ?? false,
      deletionRequestedAt: toIso(u.deletionRequestedAt),
      deletionScheduledFor: toIso(u.deletionScheduledFor),
      isAnonymized: u.isAnonymized,
      anonymizedAt: toIso(u.anonymizedAt),
    },
    authMethods: [...new Set(accounts.map((a) => a.providerId))],
    hasPassword: accounts.some((a) => a.password !== null),
    artist: artist
      ? {
          id: artist.id,
          stageName: artist.stageName,
          bio: artist.bio,
          contactEmail: artist.contactEmail,
          genres: artist.genres ?? [],
          location: artist.location,
          profileImageUrl: artist.profileImageUrl,
          coverImageUrl: artist.coverImageUrl,
          isActive: artist.isActive ?? false,
          createdAt: artist.createdAt.toISOString(),
          updatedAt: artist.updatedAt.toISOString(),
        }
      : null,
    venue: venue
      ? {
          id: venue.id,
          venueName: venue.venueName,
          address: venue.address,
          county: venue.county,
          bio: venue.bio,
          contactEmail: venue.contactEmail,
          phone: venue.phone,
          websiteUrl: venue.websiteUrl,
          lat: venue.lat,
          lng: venue.lng,
          profileImageUrl: venue.profileImageUrl,
          coverImageUrl: venue.coverImageUrl,
          subscriptionStatus: venue.subscriptionStatus,
          stripeCustomerId: venue.stripeCustomerId,
          isActive: venue.isActive ?? false,
          createdAt: venue.createdAt.toISOString(),
          updatedAt: venue.updatedAt.toISOString(),
          subscription: venueSub
            ? {
                plan: venueSub.plan,
                status: venueSub.status,
                currentPeriodEnd: toIso(venueSub.currentPeriodEnd),
              }
            : null,
        }
      : null,
    socialLinks,
    lastSession: lastSession
      ? {
          ipAddress: lastSession.ipAddress,
          userAgent: lastSession.userAgent,
          os: osFromUserAgent(lastSession.userAgent),
          createdAt: lastSession.createdAt.toISOString(),
        }
      : null,
    activeSessionCount: activeSessionRows[0]?.count ?? 0,
    devices: devices.map((d) => ({
      platform: d.platform,
      isActive: d.isActive,
      lastUsedAt: toIso(d.lastUsedAt),
    })),
    counts: {
      events: c?.events ?? 0,
      saved: c?.saved ?? 0,
      followers: c?.followers ?? 0,
      following: c?.following ?? 0,
      posts: c?.posts ?? 0,
      artistRequested: c?.artistRequested ?? 0,
      artistInvited: c?.artistInvited ?? 0,
      venueSent: c?.venueSent ?? 0,
      venueReceived: c?.venueReceived ?? 0,
    },
    recentEvents: recentEvents.map((e) => ({
      id: e.id,
      title: e.title,
      dateStart: e.dateStart.toISOString(),
      status: e.status,
    })),
  };
});

// Persona counts for the tab bar above the table. One aggregate scan over all
// non-admin users (cheap under the launch cap).
const summary = adminProcedure.query(async () => {
  const [row] = await db
    .select({
      total: count(),
      spectators: sql<number>`count(*) filter (where ${user.currentRole} = 'spectator')::int`,
      artists: sql<number>`count(*) filter (where ${user.currentRole} = 'artist')::int`,
      venues: sql<number>`count(*) filter (where ${user.currentRole} = 'venue')::int`,
    })
    .from(user)
    .where(NON_ADMIN);

  return {
    total: row?.total ?? 0,
    spectators: row?.spectators ?? 0,
    artists: row?.artists ?? 0,
    venues: row?.venues ?? 0,
  };
});

export const usersRouter = router({ list, exportAll, getById, summary });
