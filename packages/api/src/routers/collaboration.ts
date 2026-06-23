import { TRPCError } from '@trpc/server';
import { and, desc, eq } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { collaborationInterests } from '@CeolX/db/schema/collaboration';
import { artistProfiles, venueProfiles } from '@CeolX/db/schema/users';
import { NotificationTrigger, SHARE_INTEREST_COOLDOWN_MS, UserRole } from '@CeolX/shared';
import { shareInterestSchema } from '@CeolX/shared/validators';

import { creatorProcedure, router } from '../index';

// ─────────────────────────────────────────────────────────────────────────────
// collaboration router — "Share Interest" (M-?, Asana 1215700058851992).
//
// A lightweight expression of interest between an artist and a venue, NOT tied
// to any event (distinct from the M5 event-anchored booking/invite flow). The
// sender taps Share Interest on the counterparty's profile; the counterparty
// receives a notification routed back to the SENDER's profile.
//
// `creatorProcedure` already restricts the caller to artist or venue personas.
// Direction is derived from the sender's role + the recipient's profile: an
// artist may only signal a venue, and a venue only an artist. A 24h cooldown
// (SHARE_INTEREST_COOLDOWN_MS) blocks spamming the same recipient.
// ─────────────────────────────────────────────────────────────────────────────

export const collaborationRouter = router({
  shareInterest: creatorProcedure.input(shareInterestSchema).mutation(async ({ ctx, input }) => {
    const senderUserId = ctx.userId;
    const { recipientUserId } = input;

    if (recipientUserId === senderUserId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'You cannot share interest with yourself.',
      });
    }

    // Resolve the sender's profile name and validate the recipient is the
    // opposite persona by checking the matching profile row exists.
    let trigger: NotificationTrigger;
    let vars: Record<string, string>;

    if (ctx.currentRole === UserRole.ARTIST) {
      const sender = await db.query.artistProfiles.findFirst({
        where: eq(artistProfiles.userId, senderUserId),
      });
      if (!sender) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Complete your artist profile before sharing interest.',
        });
      }
      const recipientVenue = await db.query.venueProfiles.findFirst({
        where: eq(venueProfiles.userId, recipientUserId),
      });
      if (!recipientVenue) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Share Interest is only available between artists and venues.',
        });
      }
      trigger = NotificationTrigger.COLLAB_INTEREST_TO_VENUE;
      vars = { artistName: sender.stageName, artistUserId: senderUserId };
    } else if (ctx.currentRole === UserRole.VENUE) {
      const sender = await db.query.venueProfiles.findFirst({
        where: eq(venueProfiles.userId, senderUserId),
      });
      if (!sender) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Complete your venue profile before sharing interest.',
        });
      }
      const recipientArtist = await db.query.artistProfiles.findFirst({
        where: eq(artistProfiles.userId, recipientUserId),
      });
      if (!recipientArtist) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Share Interest is only available between artists and venues.',
        });
      }
      trigger = NotificationTrigger.COLLAB_INTEREST_TO_ARTIST;
      vars = { venueName: sender.venueName, venueUserId: senderUserId };
    } else {
      // Admin bypasses creatorProcedure's role gate but has no profile.
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Only artists and venues can share interest.',
      });
    }

    // Anti-spam: block re-sending to the same recipient inside the cooldown.
    const last = await db.query.collaborationInterests.findFirst({
      where: and(
        eq(collaborationInterests.senderUserId, senderUserId),
        eq(collaborationInterests.recipientUserId, recipientUserId)
      ),
      orderBy: desc(collaborationInterests.createdAt),
    });
    if (last && Date.now() - last.createdAt.getTime() < SHARE_INTEREST_COOLDOWN_MS) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: "You've already shared interest recently.",
      });
    }

    await db.insert(collaborationInterests).values({ senderUserId, recipientUserId });

    // Best-effort: the interest is already recorded (and the cooldown now
    // applies), so a notification-delivery failure must not 500 the caller —
    // that would tell the user it failed while blocking the retry. Log instead.
    try {
      await ctx.dispatchNotification({ trigger, recipientUserId, vars });
    } catch (err) {
      console.error(
        '[collaboration.shareInterest] notification dispatch failed:',
        err instanceof Error ? `${err.name}: ${err.message}` : err
      );
    }

    return { ok: true };
  }),
});
