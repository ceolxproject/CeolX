import { TRPCError } from '@trpc/server';
import { and, desc, eq, sql } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';
import { follows } from '@CeolX/db/schema/social';
import { artistProfiles, venueProfiles } from '@CeolX/db/schema/users';
import {
  followerCountSchema,
  followingQuerySchema,
  followSchema,
  isFollowingSchema,
  unfollowSchema,
} from '@CeolX/shared/validators';

import { protectedProcedure, publicProcedure, router } from '../index';

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
   * 3. Followee has at least one active profile (artist or venue)
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

    const [artistProfile, venueProfile] = await Promise.all([
      db.query.artistProfiles.findFirst({
        where: and(eq(artistProfiles.userId, followeeId), eq(artistProfiles.isActive, true)),
        columns: { id: true },
      }),
      db.query.venueProfiles.findFirst({
        where: and(eq(venueProfiles.userId, followeeId), eq(venueProfiles.isActive, true)),
        columns: { id: true },
      }),
    ]);

    if (!artistProfile && !venueProfile) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'User has no active profile' });
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
   * List all users the authenticated user follows, with profile data.
   * Optionally filter by profileType ('artist' or 'venue').
   */
  getFollowing: protectedProcedure.input(followingQuerySchema).query(async ({ ctx, input }) => {
    const { limit, offset, profileType } = input;

    const followRows = await db
      .select({
        id: follows.id,
        followeeId: follows.followeeId,
        createdAt: follows.createdAt,
      })
      .from(follows)
      .where(eq(follows.followerId, ctx.userId))
      .orderBy(desc(follows.createdAt))
      .limit(limit + 1)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(follows)
      .where(eq(follows.followerId, ctx.userId));
    const totalCount = countResult?.count ?? 0;

    const hasNextPage = followRows.length > limit;
    const rows = hasNextPage ? followRows.slice(0, limit) : followRows;

    const following = await Promise.all(
      rows.map(async (row) => {
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
          .where(and(eq(artistProfiles.userId, row.followeeId), eq(artistProfiles.isActive, true)))
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
          .where(and(eq(venueProfiles.userId, row.followeeId), eq(venueProfiles.isActive, true)))
          .limit(1);

        const type = artist ? 'artist' : venue ? 'venue' : null;
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
      if (profileType && f.profileType !== profileType) return false;
      return true;
    });

    return { following: filtered, totalCount, hasNextPage };
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
