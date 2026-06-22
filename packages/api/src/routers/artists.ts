import { TRPCError } from '@trpc/server';
import { and, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';
import { collections, eventCollaborators, events } from '@CeolX/db/schema/events';
import { follows } from '@CeolX/db/schema/social';
import { artistProfiles } from '@CeolX/db/schema/users';
import { updateArtistProfileSchema } from '@CeolX/shared/validators';

import { artistProcedure, protectedProcedure, publicProcedure, router } from '../index';

import { getFollowerCounts, getSocialLinksRecord, upsertSocialLinks } from './_profile-helpers';

export const artistsRouter = router({
  // Search artist profiles by stage name OR account name — used by InviteArtistPicker.
  // Protected: only authenticated users (venues inviting artists) may enumerate
  // artists, and the result exposes the account name (personal data) — GDPR.
  search: protectedProcedure
    .input(z.object({ q: z.string().min(1).max(100) }))
    .query(async ({ input }) => {
      const term = `%${input.q}%`;
      const results = await db
        .select({
          id: artistProfiles.userId,
          stageName: artistProfiles.stageName,
          genre: artistProfiles.genre,
          image: user.image,
          name: user.name,
        })
        .from(artistProfiles)
        .innerJoin(user, eq(artistProfiles.userId, user.id))
        .where(or(ilike(artistProfiles.stageName, term), ilike(user.name, term)))
        .limit(10);

      return { artists: results };
    }),

  // Fetch artist public profile by id (user ID). Returns NOT_FOUND if is_active = false
  // unless the requester is the profile owner.
  byId: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const [profile] = await db
      .select({
        id: artistProfiles.id,
        userId: artistProfiles.userId,
        displayName: artistProfiles.stageName,
        bio: artistProfiles.bio,
        genres: artistProfiles.genres,
        genre: artistProfiles.genre,
        location: artistProfiles.location,
        profileImageUrl: artistProfiles.profileImageUrl,
        coverImageUrl: artistProfiles.coverImageUrl,
        contactEmail: artistProfiles.contactEmail,
        isActive: artistProfiles.isActive,
        createdAt: artistProfiles.createdAt,
        updatedAt: artistProfiles.updatedAt,
        userImage: user.image,
        userName: user.name,
      })
      .from(artistProfiles)
      .innerJoin(user, eq(artistProfiles.userId, user.id))
      .where(eq(artistProfiles.userId, input.id))
      .limit(1);

    if (!profile) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Artist not found' });
    }

    // Inactive profiles return 404 unless the requester is the profile owner
    const isOwner = ctx.session?.user?.id === profile.userId;
    if (!profile.isActive && !isOwner) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Artist not found' });
    }

    const { followerCount, followingCount } = await getFollowerCounts(profile.userId);
    const socialLinksRecord = await getSocialLinksRecord(profile.userId);

    // Check if the authenticated user follows this artist
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

    // Events where this artist is creator OR collaborator
    const now = new Date();

    // Events created by the artist
    const createdEvents = await db
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
        and(eq(events.createdBy, profile.userId), inArray(events.status, ['active', 'archived']))
      );

    // Events where artist is a *confirmed* collaborator. A row is created at
    // invite time linked to a PENDING booking, so we must gate on acceptance:
    // show only rows with no booking (legacy direct-add, pre-31/05/2026) or an
    // accepted booking. Pending/declined/cancelled invites stay off the public
    // profile. Mirrors bookings.confirmedEvents / isConfirmedPerformer.
    // (Asana 1215700058851964)
    const collaboratedEvents = await db
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
      .innerJoin(eventCollaborators, eq(eventCollaborators.eventId, events.id))
      .leftJoin(collections, eq(events.collectionId, collections.id))
      .where(
        and(
          eq(eventCollaborators.artistProfileId, profile.userId),
          inArray(events.status, ['active', 'archived']),
          or(
            isNull(eventCollaborators.bookingId),
            sql`EXISTS (
              SELECT 1 FROM bookings b
              WHERE b.id = ${eventCollaborators.bookingId}
              AND b.status = 'accepted'
            )`
          )
        )
      );

    // Merge and deduplicate events
    const allEventsMap = new Map<string, (typeof createdEvents)[0]>();
    for (const e of [...createdEvents, ...collaboratedEvents]) {
      allEventsMap.set(e.id, e);
    }
    const allEvents = Array.from(allEventsMap.values());

    const upcomingEvents = allEvents
      .filter((e) => e.status === 'active' && new Date(e.dateStart) > now)
      .sort((a, b) => new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime());

    const pastEvents = allEvents
      .filter((e) => e.status === 'archived' || new Date(e.dateStart) <= now)
      .sort((a, b) => new Date(b.dateStart).getTime() - new Date(a.dateStart).getTime());

    return {
      id: profile.id,
      userId: profile.userId,
      displayName: profile.displayName,
      bio: profile.bio,
      genres: profile.genres ?? (profile.genre ? [profile.genre] : []),
      location: profile.location,
      profileImageUrl: profile.profileImageUrl ?? profile.userImage,
      coverImageUrl: profile.coverImageUrl,
      contactEmail: profile.contactEmail,
      socialLinks: socialLinksRecord,
      isActive: profile.isActive,
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

  // Update authenticated artist's own profile. All fields optional — partial update.
  updateMe: artistProcedure.input(updateArtistProfileSchema).mutation(async ({ ctx, input }) => {
    const [existing] = await db
      .select({ id: artistProfiles.id })
      .from(artistProfiles)
      .where(eq(artistProfiles.userId, ctx.userId))
      .limit(1);

    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Artist profile not found. Complete onboarding first.',
      });
    }

    const { socialLinks, displayName, ...rest } = input;

    await db.transaction(async (tx) => {
      // Build update object — only include provided fields
      const updateFields: Record<string, unknown> = { updatedAt: new Date() };
      if (displayName !== undefined) updateFields.stageName = displayName;
      if (rest.bio !== undefined) updateFields.bio = rest.bio;
      if (rest.genres !== undefined) updateFields.genres = rest.genres;
      if (rest.location !== undefined) updateFields.location = rest.location;
      if (rest.profileImageUrl !== undefined) updateFields.profileImageUrl = rest.profileImageUrl;
      if (rest.coverImageUrl !== undefined) updateFields.coverImageUrl = rest.coverImageUrl;

      await tx
        .update(artistProfiles)
        .set(updateFields)
        .where(eq(artistProfiles.userId, ctx.userId));

      await upsertSocialLinks(tx, ctx.userId, socialLinks);
    });

    return { ok: true };
  }),

  // Fetch the authenticated artist's own profile data for self-profile screen / edit form.
  me: protectedProcedure.query(async ({ ctx }) => {
    const [profile] = await db
      .select({
        id: artistProfiles.id,
        userId: artistProfiles.userId,
        stageName: artistProfiles.stageName,
        bio: artistProfiles.bio,
        genres: artistProfiles.genres,
        genre: artistProfiles.genre,
        location: artistProfiles.location,
        profileImageUrl: artistProfiles.profileImageUrl,
        coverImageUrl: artistProfiles.coverImageUrl,
        contactEmail: artistProfiles.contactEmail,
        isActive: artistProfiles.isActive,
      })
      .from(artistProfiles)
      .where(eq(artistProfiles.userId, ctx.userId))
      .limit(1);

    if (!profile) return null;

    const { followerCount, followingCount } = await getFollowerCounts(ctx.userId);
    const socialLinksRecord = await getSocialLinksRecord(ctx.userId);

    return {
      ...profile,
      genres: profile.genres ?? (profile.genre ? [profile.genre] : []),
      socialLinks: socialLinksRecord,
      followerCount,
      followingCount,
    };
  }),
});
