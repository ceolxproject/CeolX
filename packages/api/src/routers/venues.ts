import { TRPCError } from '@trpc/server';
import { and, eq, or } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';
import { collections, events } from '@CeolX/db/schema/events';
import { follows } from '@CeolX/db/schema/social';
import { venueSubscriptions } from '@CeolX/db/schema/subscriptions';
import { venueProfiles } from '@CeolX/db/schema/users';
import { sendManageSubscriptionEmail, sendVenueActivationEmail } from '@CeolX/email';
import { env } from '@CeolX/env/server';
import { ProfileVisibility, SubscriptionStatus } from '@CeolX/shared';
import { updateVenueProfileSchema } from '@CeolX/shared/validators';

import { protectedProcedure, publicProcedure, router, venueProcedure } from '../index';
import { isEventNotFinished } from '../lib/event-window';
import { buildActivationLinks } from '../services/activation-links';
import {
  millisSinceNewestActivationToken,
  revokeActivationToken,
} from '../services/activation-token';
import { millisSinceNewestPortalRequest, recordPortalRequest } from '../services/portal-throttle';
import { createBillingPortalSession, getPriceSummaries } from '../services/stripe';
import { onHoldVenueIds } from '../services/venue-gate';

import {
  getFollowerCounts,
  getSocialLinksRecord,
  resolveProfileVisibility,
  upsertSocialLinks,
} from './_profile-helpers';

/**
 * Minimum gap between activation emails for one account.
 *
 * Anchored on the newest token's age rather than a Redis counter: the repo's rate
 * limiter is unconfigured locally and switched off entirely under NODE_ENV=test,
 * so a Redis-based limit could not be verified anywhere we can actually run it.
 * This behaves identically in local, test and production. The public GET /activate
 * route is separately covered by the route-level limiter.
 */
const ACTIVATION_EMAIL_COOLDOWN_MS = 60_000;

/**
 * When the three activation nudges go out (D-26), as QStash delay strings.
 *
 * Sean asked for 24 h, then 3 days, then 7 days — one more than we proposed. Each
 * is an independent delayed job that re-checks state before sending.
 */
const ACTIVATION_REMINDER_DELAYS = ['24h', '3d', '7d'] as const;

/**
 * Minimum gap between Portal link emails for one account.
 *
 * Each request mints a real Stripe session, so this is a spend and abuse guard as
 * well as an anti-spam one.
 */
const PORTAL_EMAIL_COOLDOWN_MS = 60_000;

/** Statuses with nothing to activate — the venue already has live billing. */
const ALREADY_SUBSCRIBED = [
  SubscriptionStatus.TRIALING,
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.PAST_DUE,
] as const;

export const venuesRouter = router({
  /**
   * Email the authenticated venue a Stripe Customer Portal link (M8-T0 D-45).
   *
   * Emailed rather than returned, for the same reason as activation (D-16): no
   * billing URL may appear in the app on either store. The venue taps Manage
   * Subscription, we send the link, they finish on Stripe.
   *
   * A fresh session per request — the URL is a bearer credential for their billing
   * account, so it is never stored or reused.
   */
  requestBillingPortal: venueProcedure.mutation(async ({ ctx }) => {
    const [profile] = await db
      .select({ id: venueProfiles.id, venueName: venueProfiles.venueName })
      .from(venueProfiles)
      .where(eq(venueProfiles.userId, ctx.userId))
      .limit(1);

    if (!profile) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'No venue profile for this account' });
    }

    const [subscription] = await db
      .select({ stripeCustomerId: venueSubscriptions.stripeCustomerId })
      .from(venueSubscriptions)
      .where(eq(venueSubscriptions.venueId, profile.id))
      .limit(1);

    // No Stripe customer means they never started a subscription, so there is no
    // billing to manage. Point them at activation instead of showing an empty
    // Portal (D-45).
    if (!subscription?.stripeCustomerId) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'No subscription to manage yet — activate your profile first.',
      });
    }

    const sinceLast = await millisSinceNewestPortalRequest(ctx.userId);
    if (sinceLast !== null && sinceLast < PORTAL_EMAIL_COOLDOWN_MS) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: 'Billing link just sent — please check your inbox before retrying.',
      });
    }

    const [account] = await db
      .select({ email: user.email, name: user.name })
      .from(user)
      .where(eq(user.id, ctx.userId))
      .limit(1);

    if (!account?.email) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Account has no email address' });
    }

    const origin = env.BETTER_AUTH_URL.replace(/\/$/, '');
    const portalUrl = await createBillingPortalSession(
      subscription.stripeCustomerId,
      `${origin}/r?to=/profile`
    );

    // The email IS the deliverable, so a send failure propagates rather than
    // leaving the venue watching an inbox that will never receive anything.
    await sendManageSubscriptionEmail({
      to: account.email,
      venueName: profile.venueName,
      userName: account.name ?? '',
      portalUrl,
    });

    await recordPortalRequest(ctx.userId);

    // Never returns the URL — see D-16.
    return { sentTo: account.email };
  }),

  /**
   * Email the authenticated venue their activation links (M8-T0 D-15 → D-18).
   *
   * The email is the *deliverable* here, not a side effect, so a send failure
   * propagates rather than being swallowed — telling a venue to check an inbox
   * that will never receive anything is worse than an error they can retry. The
   * just-issued token is revoked first so the cooldown does not then lock them out
   * of that retry.
   */
  requestActivation: venueProcedure.mutation(async ({ ctx }) => {
    const [profile] = await db
      .select({
        id: venueProfiles.id,
        venueName: venueProfiles.venueName,
        subscriptionStatus: venueProfiles.subscriptionStatus,
      })
      .from(venueProfiles)
      .where(eq(venueProfiles.userId, ctx.userId))
      .limit(1);

    // requireRole lets ADMIN through every role gate, and an admin has no venue
    // profile — so this is a reachable branch, not defensive padding.
    if (!profile) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'No venue profile for this account' });
    }

    if ((ALREADY_SUBSCRIBED as readonly string[]).includes(profile.subscriptionStatus)) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'This venue already has an active subscription',
      });
    }

    const [subscription] = await db
      .select({ billingBlocked: venueSubscriptions.billingBlocked })
      .from(venueSubscriptions)
      .where(eq(venueSubscriptions.venueId, profile.id))
      .limit(1);

    // A chargeback blocks resubscription until an admin reviews the account (D-51).
    if (subscription?.billingBlocked) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'This account is under billing review. Please contact support.',
      });
    }

    const sinceLast = await millisSinceNewestActivationToken(ctx.userId);
    if (sinceLast !== null && sinceLast < ACTIVATION_EMAIL_COOLDOWN_MS) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: 'Activation email just sent — please check your inbox before retrying.',
      });
    }

    const [account] = await db
      .select({ email: user.email, name: user.name })
      .from(user)
      .where(eq(user.id, ctx.userId))
      .limit(1);

    if (!account?.email) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Account has no email address' });
    }

    // Shared with the activation-reminder job so the URL shape lives in one place.
    const { monthlyUrl, annualUrl, expiresAt, tokenId } = await buildActivationLinks(ctx.userId);

    // Best effort: the buttons read better with prices, but a Stripe outage must
    // not block the venue's only route to payment. Falling back to plain labels is
    // preferable to quoting an amount we could not verify.
    let prices: Awaited<ReturnType<typeof getPriceSummaries>> | null = null;
    try {
      prices = await getPriceSummaries();
    } catch (err) {
      console.warn(
        '[venues.requestActivation] could not read Stripe prices; sending without them:',
        err instanceof Error ? `${err.name}: ${err.message}` : err
      );
    }

    try {
      await sendVenueActivationEmail({
        to: account.email,
        venueName: profile.venueName,
        userName: account.name ?? '',
        monthlyUrl,
        annualUrl,
        monthlyPrice: prices?.monthly.formatted,
        annualPrice: prices?.annual.formatted,
        expiresInMinutes: env.ACTIVATION_TOKEN_TTL_MINUTES,
      });
    } catch (err) {
      // Unwind so the cooldown does not block an immediate retry, and so no token
      // the venue never received is left live.
      await revokeActivationToken(tokenId).catch(() => {});
      throw err;
    }

    // Schedule the three nudges (D-26). Each carries only the user id and
    // re-checks state before sending, so a venue who activates in the next hour
    // gets none of them. Fire-and-forget: the activation email is already away, and
    // failing the mutation because a reminder could not be queued would tell the
    // venue their email did not send when it did.
    await Promise.all(
      ACTIVATION_REMINDER_DELAYS.map((delay, index) =>
        ctx
          .scheduleActivationReminder(ctx.userId, (index + 1) as 1 | 2 | 3, delay)
          .catch((err: unknown) => {
            console.warn(
              `[venues.requestActivation] could not queue reminder ${index + 1}:`,
              err instanceof Error ? `${err.name}: ${err.message}` : err
            );
          })
      )
    );

    // Never returns the token or the URLs — the app must not be able to surface a
    // payment link even accidentally (D-16).
    return { sentTo: account.email, expiresAt };
  }),

  /**
   * Registered venues for the artist's event-creation picker.
   *
   * V-09: an on-hold venue is **listed, badged and not selectable** — it is NOT
   * removed. Sean's reasoning is blame attribution: an absent venue reads as CeolX
   * failing to show it, whereas "profile on hold" reads as the venue's own lapse.
   *
   * `onHold` therefore travels to the client so the picker can badge the row and
   * disable selection, and the client offers the manual-address fallback (V-05)
   * alongside it — without that exit the artist hits a dead end and the whole
   * point of D-52 inverts.
   *
   * Note the deliberate asymmetry with `discovery.suggestVenues`, which reads the
   * same rows and EXCLUDES on-hold venues (V-10). Two opposite rules over one
   * table, on purpose: the badge exists so an artist understands why they cannot
   * book, and a spectator has no use for a venue they cannot visit. Do not
   * "fix" the inconsistency.
   */
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

    const onHold = await onHoldVenueIds(rows.map((v) => v.id));

    // numeric columns come back as strings — expose coordinates as numbers so
    // the event form can pin the map from the venue's stored location directly
    // (no client-side geocoding of the address string).
    return rows.map((v) => ({
      ...v,
      lat: v.lat !== null ? Number(v.lat) : null,
      lng: v.lng !== null ? Number(v.lng) : null,
      onHold: onHold.has(v.id),
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

    // Visibility runs through the shared predicate so this screen and the
    // /u/<username> share page can never diverge (M8-T0 D-13).
    //
    // An unpaid venue is NOT a 404. It resolves to `on_hold`, and the response
    // below carries that state with the venue's identity but none of its content,
    // so the client can say the profile is on hold rather than implying CeolX lost
    // it (D-52). Serving the full payload for a hidden venue would leak exactly
    // what the gate exists to withhold, so the content fields are nulled here
    // rather than filtered client-side.
    const visibility = await resolveProfileVisibility(
      'venue',
      profile,
      ctx.session?.user?.id,
      profile.userId
    );
    if (visibility === ProfileVisibility.NOT_FOUND) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Venue not found' });
    }
    const isOnHold = visibility === ProfileVisibility.ON_HOLD;

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
      bio: isOnHold ? null : profile.bio,
      address: isOnHold ? null : profile.address,
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
      socialLinks: isOnHold ? {} : socialLinksRecord,
      // Three-way state for the client (D-52). `isActive` is retained for one
      // release as a derived value so a shipped store build that still reads it
      // keeps working — nothing in the repo tells us which versions are live, and
      // removing a key from a tRPC response produces no compiler warning. Drop it
      // once the live app versions are known.
      visibility,
      isActive: !isOnHold,
      subscriptionStatus: isOwner ? profile.subscriptionStatus : undefined,
      isOwner,
      isFollowing,
      followerCount,
      followingCount,
      upcomingEvents: isOnHold ? [] : upcomingEvents,
      pastEvents: isOnHold ? [] : pastEvents,
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
      // The owner always sees their own profile (they have to reach it to fix
      // payment), so this is unconditionally true. Retained for one release for
      // the same wire-compatibility reason as venues.byId.
      isActive: true,
      followerCount,
      followingCount,
    };
  }),
});
