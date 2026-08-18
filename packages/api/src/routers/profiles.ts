import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';
import { artistProfiles, venueProfiles } from '@CeolX/db/schema/users';
import { ProfileVisibility } from '@CeolX/shared';
import { USERNAME_MAX, usernameSchema } from '@CeolX/shared/validators';

import { publicProcedure, router } from '../index';

import { resolveProfileVisibility } from './_profile-helpers';

// Resolve a shareable handle (ceolx.com/u/<username>) to { role, userId } — just
// enough for the native redirect shim (app/(app)/u/[username].tsx) to forward to
// the existing artist/venue screen, which resolves by user id. Public: anyone
// with the link, gated by the same visibility rule as the profile screens
// (isProfileVisibleToViewer). The server-rendered share page (profile-share.ts)
// does its own DB queries for the OG unfurl and does NOT call this.
export const profilesRouter = router({
  getByUsername: publicProcedure
    .input(z.object({ username: z.string().min(1).max(USERNAME_MAX) }))
    .query(async ({ ctx, input }) => {
      // Handles are stored normalized (lowercase). Normalize the lookup key so a
      // link pasted with stray casing/whitespace still resolves.
      const handle = input.username.trim().toLowerCase();
      const viewerId = ctx.session?.user?.id;
      const notFound = () => new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found' });

      // Reserved/malformed handles can never belong to a real profile — reject
      // before the DB lookup (matches profile-share.ts; hardens against a handle
      // that somehow slipped past the auth-layer validators).
      if (!usernameSchema.safeParse(handle).success) throw notFound();

      const [account] = await db
        .select({ id: user.id, currentRole: user.currentRole })
        .from(user)
        .where(eq(user.username, handle))
        .limit(1);

      if (!account) throw notFound();

      if (account.currentRole === 'artist') {
        const [profile] = await db
          .select({
            id: artistProfiles.id,
            userId: artistProfiles.userId,
            isActive: artistProfiles.isActive,
          })
          .from(artistProfiles)
          .where(eq(artistProfiles.userId, account.id))
          .limit(1);

        if (!profile) throw notFound();
        const artistVisibility = await resolveProfileVisibility(
          'artist',
          profile,
          viewerId,
          profile.userId
        );
        if (artistVisibility !== ProfileVisibility.VISIBLE) throw notFound();
        // `visibility` is returned on BOTH branches so the response shape does not
        // depend on the role. It was venue-only, so a client reading `visibility` got
        // `undefined` for artists — and `undefined` is easy to mistake for "not
        // visible". An artist reaching here is always visible; anything else threw.
        return {
          role: 'artist' as const,
          userId: profile.userId,
          visibility: ProfileVisibility.VISIBLE,
        };
      }

      if (account.currentRole === 'venue') {
        const [profile] = await db
          .select({
            id: venueProfiles.id,
            userId: venueProfiles.userId,
            subscriptionStatus: venueProfiles.subscriptionStatus,
          })
          .from(venueProfiles)
          .where(eq(venueProfiles.userId, account.id))
          .limit(1);

        if (!profile) throw notFound();
        const venueVisibility = await resolveProfileVisibility(
          'venue',
          profile,
          viewerId,
          profile.userId
        );
        // `on_hold` resolves the handle rather than 404-ing it: the venue exists and
        // the caller (the share page) renders the on-hold state, which is the whole
        // point of D-52. Only genuine absence throws.
        if (venueVisibility === ProfileVisibility.NOT_FOUND) throw notFound();
        return {
          role: 'venue' as const,
          userId: profile.userId,
          visibility: venueVisibility,
        };
      }

      // spectator / admin have no shareable public profile
      throw notFound();
    }),
});
