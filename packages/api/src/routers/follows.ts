import { TRPCError } from '@trpc/server';
import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';
import { events } from '@CeolX/db/schema/events';
import { follows } from '@CeolX/db/schema/social';
import { artistProfiles, venueProfiles } from '@CeolX/db/schema/users';
import {
  followerCountSchema,
  followersQuerySchema,
  followingQuerySchema,
  followSchema,
  isFollowingSchema,
  unfollowSchema,
} from '@CeolX/shared/validators';

import { protectedProcedure, publicProcedure, router } from '../index';

// Counts active events per creator. Returns a Map<userId, count> with 0 default.
async function getActiveEventsCounts(userIds: string[]): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();
  const rows = await db
    .select({
      createdBy: events.createdBy,
      count: sql<number>`count(*)::int`,
    })
    .from(events)
    .where(and(inArray(events.createdBy, userIds), eq(events.status, 'active')))
    .groupBy(events.createdBy);
  return new Map(rows.map((r) => [r.createdBy, r.count]));
}

function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === '23505'
  );
}

export const followsRouter = router({
  /**
   * Follow a user. Validates:
   * 1. Not self-follow
   * 2. Followee user exists
   * 3. Followee has a public profile (artist or venue) — i.e. is not a bare spectator
   * 4. Not a duplicate (unique constraint)
   */
  follow: protectedProcedure.input(followSchema).mutation(async ({ ctx, input }) => {
    const { followeeId } = input;

    if (ctx.userId === followeeId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot follow yourself' });
    }

    const followee = await db.query.user.findFirst({
      where: eq(user.id, followeeId),
      columns: { id: true },
    });
    if (!followee) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
    }

    // Existence check only — intentionally NOT gated on `isActive` / subscription
    // status. Subscription-based visibility is deferred until the subscription
    // system ships (see venues.byId, Asana 1215489113550392), so profiles render
    // for non-owners while inactive. Requiring an *active* profile here diverged
    // from that read path: a spectator could open an inactive venue/artist profile
    // but got a 404 on Follow. Gate only on profile presence — spectators have
    // neither row, so they stay unfollowable. Restore the active gate alongside the
    // read-path gate once subscriptions are live.
    const [artistProfile, venueProfile] = await Promise.all([
      db.query.artistProfiles.findFirst({
        where: eq(artistProfiles.userId, followeeId),
        columns: { id: true },
      }),
      db.query.venueProfiles.findFirst({
        where: eq(venueProfiles.userId, followeeId),
        columns: { id: true },
      }),
    ]);

    if (!artistProfile && !venueProfile) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'User has no public profile' });
    }

    try {
      const [newFollow] = await db
        .insert(follows)
        .values({ followerId: ctx.userId, followeeId })
        .returning();
      return newFollow;
    } catch (err) {
      if (err instanceof TRPCError) throw err;
      if (isUniqueConstraintError(err)) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Already following this user' });
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create follow',
        cause: err,
      });
    }
  }),

  /** Unfollow a user. Finds the existing follow row and deletes it. */
  unfollow: protectedProcedure.input(unfollowSchema).mutation(async ({ ctx, input }) => {
    const [existingFollow] = await db
      .select({ id: follows.id })
      .from(follows)
      .where(and(eq(follows.followerId, ctx.userId), eq(follows.followeeId, input.followeeId)))
      .limit(1);

    if (!existingFollow) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Follow relationship not found' });
    }

    await db.delete(follows).where(eq(follows.id, existingFollow.id));
    return { success: true };
  }),

  /**
   * List all users `targetUserId` follows, with profile data. `targetUserId`
   * defaults to the authenticated viewer when `input.userId` is omitted, so the
   * same procedure powers both "my Following" and "their Following" screens.
   * Per-row `isFollowedByViewer` is always computed relative to the *viewer*
   * (ctx.userId) so the Follow/Following toggle stays correct on others' lists.
   * Optionally filter by profileType ('artist' or 'venue').
   */
  getFollowing: protectedProcedure.input(followingQuerySchema).query(async ({ ctx, input }) => {
    const { limit, offset, profileType } = input;
    const targetUserId = input.userId ?? ctx.userId;

    const followRows = await db
      .select({
        id: follows.id,
        followeeId: follows.followeeId,
        createdAt: follows.createdAt,
      })
      .from(follows)
      // Exclude any self-follow row (legacy data predating the mutation guard) —
      // a user must never appear in their own Following list.
      .where(and(eq(follows.followerId, targetUserId), ne(follows.followeeId, targetUserId)))
      .orderBy(desc(follows.createdAt))
      .limit(limit + 1)
      .offset(offset);

    // Count only followees that survive the list's filter below — those with an
    // artist/venue profile, excluding self-follows — so totalCount matches the
    // rendered list instead of overcounting deleted/spectator followees. Profile
    // presence only, NOT isActive: the per-row lookup below is de-gated (Asana
    // 1215489113550392) so inactive (unsubscribed) profiles still render, and the
    // count must include them. Mirrors getFollowerCounts.followingCount.
    // Asana 1216029059011258.
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(follows)
      .where(
        and(
          eq(follows.followerId, targetUserId),
          ne(follows.followeeId, targetUserId),
          sql`(
            exists (
              select 1 from ${artistProfiles}
              where ${artistProfiles.userId} = ${follows.followeeId}
            )
            or exists (
              select 1 from ${venueProfiles}
              where ${venueProfiles.userId} = ${follows.followeeId}
            )
          )`
        )
      );
    const totalCount = countResult?.count ?? 0;

    const hasNextPage = followRows.length > limit;
    const rows = hasNextPage ? followRows.slice(0, limit) : followRows;

    const following = await Promise.all(
      rows.map(async (row) => {
        // NOTE: intentionally NOT gated on `isActive`. The follow mutation and the
        // profile read paths (venues.byId / artists.byId) render inactive profiles
        // while subscription gating is deferred (Asana 1215489113550392). Gating
        // the Following list on `isActive` diverged from that: a user could follow
        // an inactive venue/artist (CTA flips to "Following", profile opens) yet it
        // silently vanished from their Following list. Match the read paths — show
        // followed profiles regardless of active state. Restore the active gate
        // here alongside the read-path gate once subscriptions are live.
        const [artist] = await db
          .select({
            id: artistProfiles.id,
            userId: artistProfiles.userId,
            displayName: artistProfiles.stageName,
            profileImageUrl: artistProfiles.profileImageUrl,
            genres: artistProfiles.genres,
            isActive: artistProfiles.isActive,
          })
          .from(artistProfiles)
          .where(eq(artistProfiles.userId, row.followeeId))
          .limit(1);

        const [venue] = await db
          .select({
            id: venueProfiles.id,
            userId: venueProfiles.userId,
            displayName: venueProfiles.venueName,
            profileImageUrl: venueProfiles.profileImageUrl,
            isActive: venueProfiles.isActive,
          })
          .from(venueProfiles)
          .where(eq(venueProfiles.userId, row.followeeId))
          .limit(1);

        const type: 'artist' | 'venue' | null = artist ? 'artist' : venue ? 'venue' : null;
        const profile = artist ?? venue;

        return {
          id: row.id,
          followeeId: row.followeeId,
          createdAt: row.createdAt,
          profileType: type,
          profile: profile
            ? {
                id: profile.id,
                userId: profile.userId,
                displayName: profile.displayName,
                profileImageUrl: artist?.profileImageUrl ?? venue?.profileImageUrl ?? null,
                genres: artist?.genres ?? null,
              }
            : null,
        };
      })
    );

    const filtered = following.filter((f) => {
      if (!f.profile) return false;
      // Defensive: never surface the profile owner inside their own Following list.
      if (f.followeeId === targetUserId) return false;
      if (profileType && f.profileType !== profileType) return false;
      return true;
    });

    const followeeIds = filtered.map((f) => f.followeeId);
    const eventsCounts = await getActiveEventsCounts(followeeIds);

    // Viewer-relative follow state: which of these followees the *current viewer*
    // (not the profile owner) already follows. Drives the Follow/Following toggle
    // so it behaves correctly when viewing someone else's Following list.
    const viewerFollowRows =
      followeeIds.length === 0
        ? []
        : await db
            .select({ followeeId: follows.followeeId })
            .from(follows)
            .where(
              and(eq(follows.followerId, ctx.userId), inArray(follows.followeeId, followeeIds))
            );
    const viewerFollowingSet = new Set(viewerFollowRows.map((r) => r.followeeId));

    const enriched = filtered.map((f) => ({
      ...f,
      eventsCount: eventsCounts.get(f.followeeId) ?? 0,
      isFollowedByViewer: viewerFollowingSet.has(f.followeeId),
      isSelf: f.followeeId === ctx.userId,
    }));

    return { following: enriched, totalCount, hasNextPage };
  }),

  /**
   * List the authenticated user's followers, with profile data + interaction state.
   * Each row includes:
   *  - profileType: 'artist' | 'venue' | null  (null = spectator follower; no public profile)
   *  - eventsCount: count of active events the follower has created
   *  - isFollowedBack: true if the authenticated user follows this follower
   * Spectator followers fall back to the base user.name / user.image so the row still renders.
   */
  getFollowers: protectedProcedure.input(followersQuerySchema).query(async ({ ctx, input }) => {
    const { limit, offset } = input;
    const targetUserId = input.userId ?? ctx.userId;

    const followRows = await db
      .select({
        id: follows.id,
        followerId: follows.followerId,
        createdAt: follows.createdAt,
      })
      .from(follows)
      .where(eq(follows.followeeId, targetUserId))
      .orderBy(desc(follows.createdAt))
      .limit(limit + 1)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(follows)
      .where(eq(follows.followeeId, targetUserId));
    const totalCount = countResult?.count ?? 0;

    const hasNextPage = followRows.length > limit;
    const rows = hasNextPage ? followRows.slice(0, limit) : followRows;
    const followerIds = rows.map((r) => r.followerId);

    if (followerIds.length === 0) {
      return { followers: [], totalCount, hasNextPage };
    }

    const [artists, venues, baseUsers, followBackRows, eventsCountRows] = await Promise.all([
      // Not gated on `isActive` — see the note in getFollowing. Inactive followers
      // still render their public profile (matching the deferred-subscription read
      // paths); restore the active gate once subscriptions ship.
      db
        .select({
          userId: artistProfiles.userId,
          displayName: artistProfiles.stageName,
          profileImageUrl: artistProfiles.profileImageUrl,
          genres: artistProfiles.genres,
        })
        .from(artistProfiles)
        .where(inArray(artistProfiles.userId, followerIds)),
      db
        .select({
          userId: venueProfiles.userId,
          displayName: venueProfiles.venueName,
          profileImageUrl: venueProfiles.profileImageUrl,
        })
        .from(venueProfiles)
        .where(inArray(venueProfiles.userId, followerIds)),
      db
        .select({ id: user.id, name: user.name, image: user.image })
        .from(user)
        .where(inArray(user.id, followerIds)),
      db
        .select({ followeeId: follows.followeeId })
        .from(follows)
        .where(and(eq(follows.followerId, ctx.userId), inArray(follows.followeeId, followerIds))),
      db
        .select({ createdBy: events.createdBy, count: sql<number>`count(*)::int` })
        .from(events)
        .where(and(inArray(events.createdBy, followerIds), eq(events.status, 'active')))
        .groupBy(events.createdBy),
    ]);
    const eventsCounts = new Map(eventsCountRows.map((r) => [r.createdBy, r.count]));

    const artistByUser = new Map(artists.map((a) => [a.userId, a]));
    const venueByUser = new Map(venues.map((v) => [v.userId, v]));
    const baseByUser = new Map(baseUsers.map((u) => [u.id, u]));
    const followedBackSet = new Set(followBackRows.map((r) => r.followeeId));

    const followers = rows.map((row) => {
      const artist = artistByUser.get(row.followerId);
      const venue = venueByUser.get(row.followerId);
      const base = baseByUser.get(row.followerId);
      const profileType: 'artist' | 'venue' | null = artist ? 'artist' : venue ? 'venue' : null;

      const profile = {
        displayName: artist?.displayName ?? venue?.displayName ?? base?.name ?? '',
        profileImageUrl: artist?.profileImageUrl ?? venue?.profileImageUrl ?? base?.image ?? null,
        genres: artist?.genres ?? null,
      };

      return {
        id: row.id,
        followerId: row.followerId,
        createdAt: row.createdAt,
        profileType,
        profile,
        eventsCount: eventsCounts.get(row.followerId) ?? 0,
        isFollowedBack: followedBackSet.has(row.followerId),
        // The viewer themselves can appear in another profile's followers list;
        // suppress the Follow toggle for that row (can't follow yourself).
        isSelf: row.followerId === ctx.userId,
      };
    });

    return { followers, totalCount, hasNextPage };
  }),

  /** Check if the authenticated user follows a specific user. */
  isFollowing: protectedProcedure.input(isFollowingSchema).query(async ({ ctx, input }) => {
    const [row] = await db
      .select({ id: follows.id })
      .from(follows)
      .where(and(eq(follows.followerId, ctx.userId), eq(follows.followeeId, input.userId)))
      .limit(1);

    return { isFollowing: !!row };
  }),

  /** Get the count of users a specific user is following. Public — no auth required. */
  getFollowingCount: publicProcedure.input(followerCountSchema).query(async ({ input }) => {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(follows)
      .where(eq(follows.followerId, input.userId));

    return { count: result?.count ?? 0 };
  }),
});
