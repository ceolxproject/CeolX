import { TRPCError } from '@trpc/server';
import { and, eq, inArray, or } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';
import { events } from '@CeolX/db/schema/events';
import { follows } from '@CeolX/db/schema/social';
import { venueProfiles } from '@CeolX/db/schema/users';
import { updateVenueProfileSchema } from '@CeolX/shared/validators';

import { protectedProcedure, publicProcedure, router, venueProcedure } from '../index';

import { getFollowerCounts, getSocialLinksRecord, upsertSocialLinks } from './_profile-helpers';

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
      })
      .from(venueProfiles)
      .orderBy(venueProfiles.venueName);
    return rows;
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
        contactEmail: venueProfiles.contactEmail,
        isActive: venueProfiles.isActive,
        subscriptionStatus: venueProfiles.subscriptionStatus,
        createdAt: venueProfiles.createdAt,
        updatedAt: venueProfiles.updatedAt,
        userImage: user.image,
      })
      .from(venueProfiles)
      .innerJoin(user, eq(venueProfiles.userId, user.id))
      .where(eq(venueProfiles.userId, input.id))
      .limit(1);

    if (!profile) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Venue not found' });
    }

    const isOwner = ctx.session?.user?.id === profile.userId;

    // Subscription gating: inactive/cancelled venues return 404 for non-owners
    if (!isOwner && profile.subscriptionStatus !== 'active') {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Venue not found' });
    }

    // Inactive profiles (is_active = false) return 404 for non-owners
    if (!isOwner && !profile.isActive) {
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
      })
      .from(events)
      .where(
        and(
          or(eq(events.venueId, profile.id), eq(events.createdBy, profile.userId)),
          inArray(events.status, ['active', 'archived'])
        )
      );

    // Deduplicate (an event could match both venueId and createdBy)
    const eventsMap = new Map<string, (typeof venueEvents)[0]>();
    for (const e of venueEvents) {
      eventsMap.set(e.id, e);
    }
    const allEvents = Array.from(eventsMap.values());

    const upcomingEvents = allEvents
      .filter((e) => e.status === 'active' && new Date(e.dateStart) > now)
      .sort((a, b) => new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime());

    const pastEvents = allEvents
      .filter((e) => e.status === 'archived' || new Date(e.dateStart) <= now)
      .sort((a, b) => new Date(b.dateStart).getTime() - new Date(a.dateStart).getTime());

    return {
      id: profile.id,
      userId: profile.userId,
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
      contactEmail: profile.contactEmail,
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
