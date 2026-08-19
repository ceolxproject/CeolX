import { TRPCError } from '@trpc/server';
import { and, eq, or } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';
import { collections, events } from '@CeolX/db/schema/events';
import { follows } from '@CeolX/db/schema/social';
import { venueProfiles } from '@CeolX/db/schema/users';
import { updateVenueProfileSchema } from '@CeolX/shared/validators';

import { protectedProcedure, publicProcedure, router, venueProcedure } from '../index';
import { isEventNotFinished } from '../lib/event-window';


import {
  getFollowerCounts,
  getSocialLinksRecord,
  isProfileVisibleToViewer,
  upsertSocialLinks,
} from './_profile-helpers';

export const venuesRouter = router({
  /** List registered venues — used by artists when picking a performance venue.
   *  Returns all venues that have a name and address set, regardless of
   *  subscription status (subscription controls *profile visibility*, not
   *  whether a venue can be referenced in an event). */
  list: publicProcedure.query(async () => {
    const rows = await db
      .select({
        id: venueProfiles.id,
        name: venueProfiles.venueName,
        address: venueProfiles.address,
        lat: venueProfiles.lat,
        lng: venueProfiles.lng,
      })
      .from(venueProfiles)
      .orderBy(venueProfiles.venueName);
    // numeric columns come back as strings — expose coordinates as numbers so
    // the event form can pin the map from the venue's stored location directly
    // (no client-side geocoding of the address string).
    return rows.map((v) => ({
      ...v,
      lat: v.lat !== null ? Number(v.lat) : null,
      lng: v.lng !== null ? Number(v.lng) : null,
    }));
  }),

  // Fetch venue public profile by id (user ID). Subscription-gated:
  // returns NOT_FOUND if subscription_status != 'active' unless requester is owner.
  byId: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const [profile] = await db
      .select({
        id: venueProfiles.id,
        userId: venueProfiles.userId,
        venueName: venueProfiles.venueName,
        bio: venueProfiles.bio,
        address: venueProfiles.address,
        county: venueProfiles.county,
        lat: venueProfiles.lat,
        lng: venueProfiles.lng,
        profileImageUrl: venueProfiles.profileImageUrl,
        coverImageUrl: venueProfiles.coverImageUrl,
        websiteUrl: venueProfiles.websiteUrl,
        phone: venueProfiles.phone,
        isActive: venueProfiles.isActive,
        subscriptionStatus: venueProfiles.subscriptionStatus,
        createdAt: venueProfiles.createdAt,
        updatedAt: venueProfiles.updatedAt,
        userImage: user.image,
        // Shareable handle — drives the Share button on this public profile
        // (shown only when set). null until the venue claims one.
        username: user.username,
      })
      .from(venueProfiles)
      .innerJoin(user, eq(venueProfiles.userId, user.id))
      .where(eq(venueProfiles.userId, input.id))
      .limit(1);

    if (!profile) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Venue not found' });
    }

    const isOwner = ctx.session?.user?.id === profile.userId;

    // Visibility runs through the shared predicate so the /u/<username> share
    // link can never diverge from this screen. Venue gating is intentionally
    // disabled until subscriptions ship — the rule (and the Asana 1215489113550392
    // restore note) lives in isProfileVisibleToViewer, so today this never 404s a
    // venue (previously the owner-only gate hid every venue from spectators).
    if (!isProfileVisibleToViewer('venue', profile, ctx.session?.user?.id, profile.userId)) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Venue not found' });
    }

    const { followerCount, followingCount } = await getFollowerCounts(profile.userId);
    const socialLinksRecord = await getSocialLinksRecord(profile.userId);

    // Check if the authenticated user follows this venue
    let isFollowing = false;
    if (ctx.session?.user?.id && ctx.session.user.id !== profile.userId) {
      const [followRow] = await db
        .select({ id: follows.id })
        .from(follows)
        .where(
          and(eq(follows.followerId, ctx.session.user.id), eq(follows.followeeId, profile.userId))
        )
        .limit(1);
      isFollowing = !!followRow;
    }

    // Events linked to this venue (via venueId FK) or created by this venue user
    const now = new Date();
    const venueEvents = await db
      .select({
        id: events.id,
        title: events.title,
        coverImage: events.coverImage,
        dateStart: events.dateStart,
        dateEnd: events.dateEnd,
        venueAddress: events.venueAddress,
        category: events.category,
        status: events.status,
        collectionName: collections.name,
      })
      .from(events)
      .leftJoin(collections, eq(events.collectionId, collections.id))
      .where(
        and(
          or(eq(events.venueId, profile.id), eq(events.createdBy, profile.userId)),
          // 'archived' = creator-deleted (the only writer of that status). A deleted
          // event must vanish from every persona's view, so the public profile shows
          // ACTIVE only. Naturally-past events stay ACTIVE with a past date and still
          // surface under Past Events below. (Asana 1216029058657584)
          eq(events.status, 'active')
        )
      );

    // Deduplicate (an event could match both venueId and createdBy)
    const eventsMap = new Map<string, (typeof venueEvents)[0]>();
    for (const e of venueEvents) {
      eventsMap.set(e.id, e);
    }
    const allEvents = Array.from(eventsMap.values());

    // Past vs upcoming is purely date-driven now that only ACTIVE events reach here.
    // Keep the explicit status guard as defense-in-depth so a deleted event can never
    // slip into either bucket even if the query filter regresses.
    // Split on "has it finished" — same rule as the map, feed, search and collections.
    // While this compared dateStart, a venue's own trad session running 21:00-01:00 sat
    // under Past Events at 22:00 while every other surface correctly showed it.
    const upcomingEvents = allEvents
      .filter((e) => e.status === 'active' && isEventNotFinished(e, now))
      .sort((a, b) => new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime());

    const pastEvents = allEvents
      .filter((e) => e.status === 'active' && !isEventNotFinished(e, now))
      .sort((a, b) => new Date(b.dateStart).getTime() - new Date(a.dateStart).getTime());

    return {
      id: profile.id,
      userId: profile.userId,
      username: profile.username,
      displayName: profile.venueName,
      bio: profile.bio,
      address: profile.address,
      county: profile.county,
      lat: profile.lat ? Number(profile.lat) : null,
      lng: profile.lng ? Number(profile.lng) : null,
      profileImageUrl: profile.profileImageUrl ?? profile.userImage,
      coverImageUrl: profile.coverImageUrl,
      websiteUrl: profile.websiteUrl,
      phone: profile.phone,
      // Public profile — never carries an email. See artists.byId for why the
      // key stays in the response instead of being dropped.
      contactEmail: null,
      socialLinks: socialLinksRecord,
      isActive: profile.isActive,
      subscriptionStatus: isOwner ? profile.subscriptionStatus : undefined,
      isOwner,
      isFollowing,
      followerCount,
      followingCount,
      upcomingEvents,
      pastEvents,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }),

  // Update authenticated venue's own profile. All fields optional — partial update.
  updateMe: venueProcedure.input(updateVenueProfileSchema).mutation(async ({ ctx, input }) => {
    const [existing] = await db
      .select({ id: venueProfiles.id })
      .from(venueProfiles)
      .where(eq(venueProfiles.userId, ctx.userId))
      .limit(1);

    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Venue profile not found. Complete onboarding first.',
      });
    }

    const { socialLinks, displayName, ...rest } = input;

    await db.transaction(async (tx) => {
      const updateFields: Record<string, unknown> = { updatedAt: new Date() };
      if (displayName !== undefined) updateFields.venueName = displayName;
      if (rest.bio !== undefined) updateFields.bio = rest.bio;
      if (rest.address !== undefined) updateFields.address = rest.address;
      if (rest.county !== undefined) updateFields.county = rest.county;
      if (rest.lat !== undefined) updateFields.lat = String(rest.lat);
      if (rest.lng !== undefined) updateFields.lng = String(rest.lng);
      if (rest.profileImageUrl !== undefined) updateFields.profileImageUrl = rest.profileImageUrl;
      if (rest.coverImageUrl !== undefined) updateFields.coverImageUrl = rest.coverImageUrl;
      if (rest.websiteUrl !== undefined) updateFields.websiteUrl = rest.websiteUrl;
      if (rest.phone !== undefined) updateFields.phone = rest.phone;

      await tx.update(venueProfiles).set(updateFields).where(eq(venueProfiles.userId, ctx.userId));

      await upsertSocialLinks(tx, ctx.userId, socialLinks);
    });

    return { ok: true };
  }),

  // Fetch the authenticated venue's own profile data for self-profile screen / edit form.
  me: protectedProcedure.query(async ({ ctx }) => {
    const [profile] = await db
      .select({
        id: venueProfiles.id,
        userId: venueProfiles.userId,
        venueName: venueProfiles.venueName,
        bio: venueProfiles.bio,
        address: venueProfiles.address,
        county: venueProfiles.county,
        lat: venueProfiles.lat,
        lng: venueProfiles.lng,
        profileImageUrl: venueProfiles.profileImageUrl,
        coverImageUrl: venueProfiles.coverImageUrl,
        websiteUrl: venueProfiles.websiteUrl,
        phone: venueProfiles.phone,
        contactEmail: venueProfiles.contactEmail,
        isActive: venueProfiles.isActive,
        subscriptionStatus: venueProfiles.subscriptionStatus,
      })
      .from(venueProfiles)
      .where(eq(venueProfiles.userId, ctx.userId))
      .limit(1);

    if (!profile) return null;

    const { followerCount, followingCount } = await getFollowerCounts(ctx.userId);
    const socialLinksRecord = await getSocialLinksRecord(ctx.userId);

    return {
      ...profile,
      lat: profile.lat ? Number(profile.lat) : null,
      lng: profile.lng ? Number(profile.lng) : null,
      socialLinks: socialLinksRecord,
      followerCount,
      followingCount,
    };
  }),
});
