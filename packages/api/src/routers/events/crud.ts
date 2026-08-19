import { randomUUID } from 'node:crypto';

import { TRPCError } from '@trpc/server';
import { and, countDistinct, desc, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { unionAll } from 'drizzle-orm/pg-core';
import { z } from 'zod';

import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';
import { bookings } from '@CeolX/db/schema/bookings';
import { collections, eventCollaborators, events, savedEvents } from '@CeolX/db/schema/events';
import { posts } from '@CeolX/db/schema/social';
import { artistProfiles, venueProfiles } from '@CeolX/db/schema/users';
import { sendCollaboratorInviteEmail } from '@CeolX/email';
import {
  BookingDirection,
  BookingStatus,
  EventStatus,
  formatNotificationDate,
  NotificationTrigger,
  UserRole,
} from '@CeolX/shared';
import {
  createEventSchema,
  myEventsQuerySchema,
  updateEventSchema,
} from '@CeolX/shared/validators';

import type { DispatchNotificationInput } from '../../context';
import { creatorProcedure, protectedProcedure, publicProcedure } from '../../index';
import { eventFinished, eventNotFinished } from '../../lib/event-window';
import { syncEventToTypesense, removeEventFromTypesense } from '../../services/event-sync';
import { syncPromoPost } from '../../services/promo-post';

import { resolveEventCoordinates, resolveProfileImageUrl } from './helpers';
import { recordEventView } from './view-tracking';

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Outside-platform ("unregistered") collaborator invites get a 14-day opaque
// token that powers the public /invite/:token landing; the claim itself matches
// on the canonicalised invitedEmail when the invitee signs up as an artist
// (onboarding.createArtistProfile). Mirrors bookings.inviteExternal — matrix A-14.
const INVITE_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;

type PendingInviteEmail = Parameters<typeof sendCollaboratorInviteEmail>[0];

/** Canonical email key so dedup + the signup email-match claim agree on one form. */
function canonicalEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Build the public invite landing URL. PUBLIC_WEB_ORIGIN is the ceolx.com web origin. */
function inviteUrl(token: string): string {
  const origin = process.env.PUBLIC_WEB_ORIGIN ?? 'https://ceolx.com';
  return `${origin}/invite/${token}`;
}

/**
 * Display name shown in the invite email ("<inviterName> invited you…"). A venue
 * uses its venueName, an artist their stageName, with safe fallbacks.
 */
async function resolveInviterName(
  tx: DbTransaction,
  userId: string,
  isVenue: boolean
): Promise<string> {
  if (isVenue) {
    const venue = await tx.query.venueProfiles.findFirst({
      where: eq(venueProfiles.userId, userId),
      columns: { venueName: true },
    });
    return venue?.venueName ?? 'A CeolX venue';
  }
  const artist = await tx.query.artistProfiles.findFirst({
    where: eq(artistProfiles.userId, userId),
    columns: { stageName: true },
  });
  return artist?.stageName ?? 'A CeolX artist';
}

/**
 * Send queued invite emails after the transaction commits — a rollback must not
 * leave phantom invites. A send failure must NOT fail the request: the
 * collaborator row is already persisted and shows as pending regardless (R8.5).
 */
async function flushInviteEmails(emails: PendingInviteEmail[]): Promise<void> {
  await Promise.all(
    emails.map((email) =>
      sendCollaboratorInviteEmail(email).catch((err: unknown) => {
        console.error('[events] collaborator invite email failed', err);
      })
    )
  );
}

/**
 * Withdraw the current pending artist→venue request for an event (if any) and
 * detach its collaborator rows. Used when an artist switches or drops the
 * registered venue on edit, so a stale request can't linger. (Asana 1215189395180422)
 */
async function cancelPendingVenueRequest(tx: DbTransaction, eventId: string, userId: string) {
  const prior = await tx.query.bookings.findFirst({
    where: and(
      eq(bookings.eventId, eventId),
      eq(bookings.direction, BookingDirection.ARTIST_TO_VENUE),
      eq(bookings.status, BookingStatus.PENDING)
    ),
  });
  if (!prior) return;
  await tx
    .update(bookings)
    .set({ status: BookingStatus.CANCELLED, cancelledBy: userId, updatedAt: new Date() })
    .where(eq(bookings.id, prior.id));
  await tx.delete(eventCollaborators).where(eq(eventCollaborators.bookingId, prior.id));
}

/** Look up a registered venue's stored pin so events can inherit it. */
const lookupVenueCoords = async (venueId: string) => {
  const [venue] = await db
    .select({ lat: venueProfiles.lat, lng: venueProfiles.lng })
    .from(venueProfiles)
    .where(eq(venueProfiles.id, venueId))
    .limit(1);
  return venue ?? null;
};

/**
 * A row in `event_collaborators` only counts as a *confirmed performer* — i.e.
 * something the event detail screen should surface in its Artist / Performing
 * Artist sections — when it is a real platform artist (so `artistProfileId` is
 * set, which excludes venue-participant rows and unregistered email invites)
 * AND it either has no booking (legacy auto-confirmed direct-add) or a booking
 * the artist has accepted. Pending invites, external email invites, and venue
 * rows are intentionally hidden until accepted. Mirrors the rule in
 * `bookings.confirmedEvents`. See CLAUDE.md (confirmed collaborator = ACCEPTED).
 */
export function isConfirmedPerformer(
  collaborator: { artistProfileId: string | null; bookingId: string | null },
  acceptedBookingIds: Set<string>
): boolean {
  if (collaborator.artistProfileId === null) return false;
  return collaborator.bookingId === null || acceptedBookingIds.has(collaborator.bookingId);
}

/**
 * An *external invitee* is an outside-platform performer added by name/email:
 * `artistProfileId` is null (no account), `venueProfileId` is null (not a venue
 * participant row), and an `invitedName` was supplied. These can't accept an
 * invite in-app, so we surface them as confirmed-looking, **non-tappable** cards
 * (placeholder image, no /artist/:id link). Excludes venue-participant rows,
 * which are also account-less but carry a `venueProfileId`.
 */
export function isExternalInvitee(collaborator: {
  artistProfileId: string | null;
  venueProfileId: string | null;
  invitedName: string | null;
}): boolean {
  return (
    collaborator.artistProfileId === null &&
    collaborator.venueProfileId === null &&
    collaborator.invitedName !== null
  );
}

/**
 * The outside-platform invitees of an event, shaped for the edit form's
 * `unregisteredCollaborators` field. Uses the same `isExternalInvitee`
 * definition as the display list, so only genuine name/email invites qualify.
 *
 * This deliberately excludes account-less *venue-participant* rows (which carry
 * a `venueProfileId` and no `invitedName`). The previous loose
 * `!c.artistProfileId` filter let those through as `{ name: '', email: '' }`,
 * which the edit form then re-submitted — failing the create/edit schema's
 * `name.min(1)` rule with "Too small expected string to have >=1".
 */
export function toUnregisteredCollaborators(
  collaborators: Array<{
    artistProfileId: string | null;
    venueProfileId: string | null;
    invitedName: string | null;
    invitedEmail: string | null;
    invitedImageUrl?: string | null;
  }>
): Array<{ name: string; email: string; imageUrl?: string }> {
  return collaborators.filter(isExternalInvitee).map((c) => ({
    name: c.invitedName ?? '',
    email: c.invitedEmail ?? '',
    imageUrl: c.invitedImageUrl ?? undefined,
  }));
}

/**
 * A booking is a *pending platform invite* — the kind that should seed the edit
 * form's "Invite Artists" field — when it is a still-unaccepted performer invite
 * the creator sent: venue→artist or artist→artist (co-artist). An artist→venue
 * row is a pending booking too, but it's the venue-consent request, not a
 * performer invite, so it's excluded. Accepted invites become confirmed
 * performers (shown in the event-detail Performers section) and aren't managed
 * here. (Asana 1215912673233456)
 */
export function isPendingPlatformInvite(booking: { status: string; direction: string }): boolean {
  return (
    booking.status === BookingStatus.PENDING &&
    (booking.direction === BookingDirection.VENUE_TO_ARTIST ||
      booking.direction === BookingDirection.ARTIST_TO_ARTIST)
  );
}

/**
 * Diff the platform-invite list submitted on edit against what already exists,
 * yielding the artists to newly invite and the pending invites to withdraw.
 *
 * - `toAdd`: submitted artists not already linked to the event (any existing
 *   collaborator — pending, accepted, or legacy — is skipped so re-saving never
 *   duplicates an invite).
 * - `toRemove`: previously-pending invites the creator dropped from the field.
 *   Only the pending set is removable, so an accepted performer that's no longer
 *   in the field is left untouched (its booking is cancelled through the booking
 *   flow, never silently here).
 *
 * The creator's own id is never added or removed — an artist can't invite
 * themselves, and the artist→venue consent row that carries the creator's id is
 * not a performer invite. (Asana 1215912673233456)
 */
export function diffPlatformInvites(
  submittedUserIds: readonly string[],
  existingCollaboratorUserIds: readonly string[],
  existingPendingInviteUserIds: readonly string[],
  selfUserId: string
): { toAdd: string[]; toRemove: string[] } {
  const submitted = new Set(submittedUserIds.filter((id) => id !== selfUserId));
  const existingCollaborators = new Set(existingCollaboratorUserIds);
  const toAdd = [...submitted].filter((id) => !existingCollaborators.has(id));
  const toRemove = existingPendingInviteUserIds.filter(
    (id) => id !== selfUserId && !submitted.has(id)
  );
  return { toAdd, toRemove };
}

/**
 * Visibility guard for an event fetched by id. Archived (creator-deleted) and
 * admin-removed events have been pulled from every public surface (map, feed,
 * search, profiles, collections), so the detail endpoint must hide them from
 * everyone except their creator — who still needs access to a removed event's
 * removal reason to edit and resubmit, or to review an archived one. Anonymous
 * viewers (`viewerUserId === null`) never match the creator, so they're excluded
 * too. Other statuses are out of scope here: active is public, and the
 * pre-publication draft / pending_review / rejected states are handled by their
 * own flows — notably pending_review must stay visible to the tagged venue for
 * the consent flow, so it is intentionally not guarded here. Asana 1216029035679712.
 */
export function isHiddenFromViewer(
  event: { status: EventStatus; createdBy: string },
  viewerUserId: string | null
): boolean {
  const creatorOnly = event.status === EventStatus.ARCHIVED || event.status === EventStatus.REMOVED;
  return creatorOnly && event.createdBy !== viewerUserId;
}

export const byId = publicProcedure
  .input(z.object({ id: z.string().uuid() }))
  .query(async ({ input, ctx }) => {
    const userId = ctx.session?.user?.id ?? null;

    const event = await db.query.events.findFirst({
      where: eq(events.id, input.id),
      with: {
        collaborators: true,
        creator: true,
        venue: true,
        collection: true,
      },
    });

    if (!event) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
    }

    // Archived (creator-deleted) and admin-removed events are visible only to
    // their creator — see isHiddenFromViewer. Asana 1216029035679712.
    if (isHiddenFromViewer(event, userId)) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
    }

    // Fire-and-forget per-event view tracking (M11-T3). Helper is best-effort
    // and skips anonymous viewers + the creator themselves.
    void recordEventView({
      eventId: event.id,
      viewerUserId: userId,
      eventCreatorId: event.createdBy,
    });

    const collaboratorUserIds = event.collaborators
      .map((c) => c.artistProfileId)
      .filter((id): id is string => id !== null);

    const collaboratorBookingIds = event.collaborators
      .map((c) => c.bookingId)
      .filter((id): id is string => id !== null);

    // Upcoming-event count per collaborator for the Performing Artist card badge.
    // It must equal the artist profile's upcoming list (artists.byId), so mirror
    // that query exactly: distinct ACTIVE, future-dated events where the artist is
    // the creator OR an ACCEPTED collaborator. Counting raw event_collaborators
    // rows drifts above the rendered list — it ignores created events and counts
    // archived/pending/past. (Asana 1216032428715513)
    const createdUpcoming = db
      .select({ artistId: events.createdBy, eventId: events.id })
      .from(events)
      .where(
        and(
          inArray(events.createdBy, collaboratorUserIds),
          eq(events.status, 'active'),
          eventNotFinished()
        )
      );
    const collaboratedUpcoming = db
      // artistProfileId is nullable in the schema but the inArray filter below
      // excludes nulls; cast so the union shape matches createdUpcoming.
      .select({ artistId: sql<string>`${eventCollaborators.artistProfileId}`, eventId: events.id })
      .from(eventCollaborators)
      .innerJoin(events, eq(events.id, eventCollaborators.eventId))
      .where(
        and(
          inArray(eventCollaborators.artistProfileId, collaboratorUserIds),
          eq(events.status, 'active'),
          eventNotFinished(),
          or(
            isNull(eventCollaborators.bookingId),
            sql`EXISTS (SELECT 1 FROM ${bookings} WHERE ${bookings.id} = ${eventCollaborators.bookingId} AND ${bookings.status} = 'accepted')`
          )
        )
      );
    const upcomingArtistEvents = unionAll(createdUpcoming, collaboratedUpcoming).as(
      'upcoming_artist_events'
    );

    const [
      collaboratorProfiles,
      collaboratorUsers,
      collaboratorEventCounts,
      attendeeCount,
      savedRow,
      relatedEvents,
      creatorArtistProfile,
      creatorVenueProfile,
      collaboratorBookings,
      viewerPendingRows,
    ] = await Promise.all([
      // stageName + genre for each collaborator
      collaboratorUserIds.length > 0
        ? db
            .select()
            .from(artistProfiles)
            .where(inArray(artistProfiles.userId, collaboratorUserIds))
        : Promise.resolve([]),

      // user.image for each collaborator — only a fallback; the uploaded
      // profile picture in artist_profiles.profileImageUrl takes precedence
      // (see resolveProfileImageUrl). Asana 1215429148917917
      collaboratorUserIds.length > 0
        ? db
            .select({ id: user.id, image: user.image, name: user.name })
            .from(user)
            .where(inArray(user.id, collaboratorUserIds))
        : Promise.resolve([]),

      // event count per collaborator — distinct upcoming events (see
      // upcomingArtistEvents above) so the badge matches the artist profile list.
      collaboratorUserIds.length > 0
        ? db
            .select({
              artistProfileId: upcomingArtistEvents.artistId,
              count: countDistinct(upcomingArtistEvents.eventId),
            })
            .from(upcomingArtistEvents)
            .groupBy(upcomingArtistEvents.artistId)
        : Promise.resolve([]),

      // total saves == "attending" proxy
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(savedEvents)
        .where(eq(savedEvents.eventId, input.id))
        .then((rows) => rows[0]?.count ?? 0),

      // has current user saved this event?
      userId
        ? db.query.savedEvents.findFirst({
            where: and(eq(savedEvents.userId, userId), eq(savedEvents.eventId, input.id)),
          })
        : Promise.resolve(null),

      // related events from same collection (up to 5) — upcoming only.
      // A past event stays status='active' (only creator-delete flips it to
      // archived), so a status filter alone leaks elapsed events into the
      // "Explore the collection" preview. Mirror collections.byId's
      // isUpcomingEvent so this preview and the "see all"
      // list show the same events. (Asana 1216297161493463)
      event.collectionId
        ? db.query.events.findMany({
            where: and(
              eq(events.collectionId, event.collectionId),
              eq(events.status, EventStatus.ACTIVE),
              eventNotFinished(),
              ne(events.id, input.id)
            ),
            columns: {
              id: true,
              title: true,
              dateStart: true,
              category: true,
              coverImage: true,
              venueAddress: true,
            },
            limit: 5,
          })
        : Promise.resolve([]),

      // creator profile — try artist first
      db.query.artistProfiles.findFirst({
        where: eq(artistProfiles.userId, event.createdBy),
      }),

      // creator profile — try venue
      db.query.venueProfiles.findFirst({
        where: eq(venueProfiles.userId, event.createdBy),
      }),

      // status + direction for this event's collaborator bookings — drives both
      // the confirmed-performer filter (accepted ones) and the pending-invite
      // list that seeds the edit form's Invite Artists field.
      collaboratorBookingIds.length > 0
        ? db
            .select({
              id: bookings.id,
              status: bookings.status,
              direction: bookings.direction,
            })
            .from(bookings)
            .where(inArray(bookings.id, collaboratorBookingIds))
        : Promise.resolve([]),

      // Does the viewing artist already have a PENDING performance request on
      // this event? Drives the "Request to Perform" vs "Request Sent" CTA. A
      // withdrawn/declined request is not pending, so the button returns —
      // letting the artist ask again. (Asana 1215700058851990, bugs #4/#5)
      userId
        ? db
            .select({ id: bookings.id })
            .from(bookings)
            .innerJoin(artistProfiles, eq(bookings.artistId, artistProfiles.id))
            .where(
              and(
                eq(bookings.eventId, input.id),
                eq(artistProfiles.userId, userId),
                eq(bookings.direction, BookingDirection.ARTIST_TO_VENUE),
                eq(bookings.status, BookingStatus.PENDING)
              )
            )
            .limit(1)
        : Promise.resolve([]),
    ]);

    const profileByUserId = new Map(collaboratorProfiles.map((p) => [p.userId, p]));
    const userImageById = new Map(collaboratorUsers.map((u) => [u.id, u.image]));
    const userNameById = new Map(collaboratorUsers.map((u) => [u.id, u.name]));
    const countByUserId = new Map(collaboratorEventCounts.map((r) => [r.artistProfileId, r.count]));

    const acceptedBookingIds = new Set(
      collaboratorBookings.filter((b) => b.status === BookingStatus.ACCEPTED).map((b) => b.id)
    );
    // Bookings whose invitee hasn't accepted yet — drives the edit form's
    // pre-populated Invite Artists field. (Asana 1215912673233456)
    const pendingInviteBookingIds = new Set(
      collaboratorBookings.filter(isPendingPlatformInvite).map((b) => b.id)
    );

    // Rows the UI may show: confirmed performers (accepted bookings + legacy
    // auto-confirmed direct-adds) and outside-platform invitees (shown as
    // non-tappable name cards). Excludes pending platform invites and
    // venue-participant rows. (Asana — event detail showed broken "Invited
    // Artist" cards that navigated nowhere.)
    const displayCollaborators = event.collaborators.filter(
      (c) => isConfirmedPerformer(c, acceptedBookingIds) || isExternalInvitee(c)
    );

    // Pending platform-artist invites, shaped as the edit form's ArtistResult so
    // the venue/organiser sees who they've already invited and can add/remove.
    // Mirrors the confirmed-performer mapping below for stageName/genre/image.
    const platformInvites = event.collaborators
      .filter(
        (c) =>
          c.artistProfileId !== null &&
          c.bookingId !== null &&
          pendingInviteBookingIds.has(c.bookingId)
      )
      .map((c) => {
        const artistUserId = c.artistProfileId as string;
        const profile = profileByUserId.get(artistUserId);
        return {
          id: artistUserId,
          stageName: profile?.stageName ?? 'Unknown Artist',
          genre: profile?.genres?.[0] ?? profile?.genre ?? null,
          image: resolveProfileImageUrl(profile, userImageById.get(artistUserId)),
          name: userNameById.get(artistUserId) ?? null,
        };
      });

    return {
      id: event.id,
      title: event.title,
      description: event.description,
      dateStart: event.dateStart.toISOString(),
      dateEnd: event.dateEnd?.toISOString() ?? null,
      lat: parseFloat(event.lat),
      lng: parseFloat(event.lng),
      venueAddress: event.venueAddress ?? null,
      category: event.category,
      coverImage: event.coverImage ?? null,
      coverImageUrl: event.coverImage ?? null,
      ticketLink: event.ticketLink ?? null,
      ticketPrice: event.ticketPrice ?? null,
      adTitle: event.adTitle ?? null,
      adDescription: event.adDescription ?? null,
      venueId: event.venueId ?? null,
      venueUserId: event.venue?.userId ?? null,
      collectionId: event.collectionId ?? null,
      status: event.status,
      removalReason: event.removalReason ?? null,
      creator: {
        id: event.createdBy,
        name:
          creatorArtistProfile?.stageName ??
          creatorVenueProfile?.venueName ??
          event.creator?.name ??
          'Unknown',
        imageUrl: resolveProfileImageUrl(
          creatorArtistProfile ?? creatorVenueProfile,
          event.creator?.image
        ),
        type: creatorArtistProfile ? UserRole.ARTIST : UserRole.VENUE,
      },
      // Confirmed performers + external invitees. Platform rows carry the
      // artist's user id as `id` (a valid /artist/:id target); external rows
      // carry the collaborator row id and `isExternal: true` so the client
      // renders a non-tappable placeholder card.
      collaborators: displayCollaborators.map((c) => {
        if (!c.artistProfileId) {
          // Outside-platform invitee — name only, no account/profile to link to.
          return {
            id: c.id,
            stageName: c.invitedName ?? 'Invited Artist',
            genre: null,
            profileImageUrl: c.invitedImageUrl ?? null,
            eventCount: 0,
            isExternal: true,
          };
        }
        const artistUserId = c.artistProfileId;
        const profile = profileByUserId.get(artistUserId);
        return {
          id: artistUserId,
          stageName: profile?.stageName ?? 'Unknown Artist',
          // `genres` (text[]) is the live field; fall back to the deprecated
          // singular `genre` column for legacy profiles.
          genre: profile?.genres?.[0] ?? profile?.genre ?? null,
          profileImageUrl: resolveProfileImageUrl(profile, userImageById.get(artistUserId)),
          eventCount: countByUserId.get(artistUserId) ?? 0,
          isExternal: false,
        };
      }),
      unregisteredCollaborators: toUnregisteredCollaborators(event.collaborators),
      // Pending platform-artist invites, for pre-populating the edit form's
      // Invite Artists field. (Asana 1215912673233456)
      platformInvites,
      collection: event.collection
        ? { id: event.collection.id, name: event.collection.name }
        : null,
      isSaved: !!savedRow,
      // True only while the viewer has a still-pending performance request on
      // this event — flips back to false on withdraw/decline so the CTA resets.
      viewerHasPendingRequest: viewerPendingRows.length > 0,
      attendeeCount,
      relatedEvents: relatedEvents.map((e) => ({
        id: e.id,
        title: e.title,
        dateStart: e.dateStart.toISOString(),
        category: e.category,
        coverImageUrl: e.coverImage ?? null,
        venueAddress: e.venueAddress ?? null,
      })),
    };
  });

export const create = creatorProcedure.input(createEventSchema).mutation(async ({ input, ctx }) => {
  const { platformInvites, unregisteredCollaborators, shareToFeed, ...eventData } = input;

  const isVenue = ctx.session.user.currentRole === UserRole.VENUE;

  // Exclude the creator from their own invite list (artists could otherwise
  // search and invite themselves). platformInvites carry userIds.
  const inviteUserIds = (platformInvites ?? []).filter((id) => id !== ctx.userId);

  // Ad fields are venue-only — strip them for non-venue creators
  if (!isVenue) {
    eventData.adTitle = undefined;
    eventData.adDescription = undefined;
  }

  // An artist tagging a registered venue must get the venue's consent first: the
  // event is held at pending_review (off map/feed) until the venue accepts the
  // request. A venue creating its own event, or an artist using a free-text
  // address (no profile to consent), goes live immediately. (Asana 1215189395180422)
  const heldForVenueApproval = !isVenue && !!eventData.venueId;

  // Resolve real coordinates before persisting — explicit pin first, else the
  // selected venue's stored pin. Throws if neither resolves, so we never write
  // the (0,0) fallback that made events vanish from the map and feed.
  const { lat, lng } = await resolveEventCoordinates(eventData, lookupVenueCoords);

  // Collected inside the transaction; fired after commit so a rollback
  // doesn't leave us with phantom notifications. See M7-T1 dispatcher.
  const pendingDispatches: DispatchNotificationInput[] = [];
  // Outside-platform invite emails, likewise flushed after commit.
  const pendingInviteEmails: PendingInviteEmail[] = [];

  const event = await db.transaction(async (tx) => {
    const rows = await tx
      .insert(events)
      .values({
        title: eventData.title,
        description: eventData.description,
        coverImage: eventData.coverImage ?? null,
        dateStart: new Date(eventData.dateStart),
        dateEnd: eventData.dateEnd ? new Date(eventData.dateEnd) : null,
        lat,
        lng,
        venueId: eventData.venueId ?? null,
        venueAddress: eventData.venueAddress ?? null,
        category: eventData.category,
        ticketLink: eventData.ticketLink ?? null,
        ticketPrice: eventData.ticketPrice ?? null,
        collectionId: eventData.collectionId ?? null,
        adTitle: eventData.adTitle ?? null,
        adDescription: eventData.adDescription ?? null,
        createdBy: ctx.userId,
        status: heldForVenueApproval ? EventStatus.PENDING_REVIEW : EventStatus.ACTIVE,
      })
      .returning();

    const inserted = rows[0];
    if (!inserted) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Insert failed' });

    // Insert non-platform (invited) artists as eventCollaborators rows, each with
    // an opaque invite token, then queue the invite email (matrix A-14). Without
    // this the invitee was saved but never emailed — the event form is the only
    // caller, so bookings.inviteExternal's email path was never reached.
    if (unregisteredCollaborators && unregisteredCollaborators.length > 0) {
      const inviterName = await resolveInviterName(tx, ctx.userId, isVenue);
      const rows = unregisteredCollaborators.map((invite) => ({
        eventId: inserted.id,
        invitedName: invite.name,
        invitedEmail: canonicalEmail(invite.email),
        invitedImageUrl: invite.imageUrl ?? null,
        inviteToken: randomUUID(),
        inviteTokenExpiresAt: new Date(Date.now() + INVITE_TOKEN_TTL_MS),
      }));
      await tx.insert(eventCollaborators).values(rows);

      for (const row of rows) {
        pendingInviteEmails.push({
          to: row.invitedEmail,
          inviterName,
          eventTitle: inserted.title,
          eventDate: formatNotificationDate(inserted.dateStart),
          inviteUrl: inviteUrl(row.inviteToken),
        });
      }
    }

    // Platform invites → pending bookings for invited artists.
    if (inviteUserIds.length > 0) {
      const inviteProfiles = await tx
        .select({
          id: artistProfiles.id,
          userId: artistProfiles.userId,
          stageName: artistProfiles.stageName,
        })
        .from(artistProfiles)
        .where(inArray(artistProfiles.userId, inviteUserIds));

      if (isVenue) {
        // ── Venue → Artist (existing behaviour) ──
        const venueProfile = await tx.query.venueProfiles.findFirst({
          where: eq(venueProfiles.userId, ctx.userId),
          columns: { id: true, venueName: true },
        });
        if (venueProfile) {
          for (const ap of inviteProfiles) {
            const [booking] = await tx
              .insert(bookings)
              .values({
                artistId: ap.id,
                venueId: venueProfile.id,
                eventId: inserted.id,
                status: BookingStatus.PENDING,
                direction: BookingDirection.VENUE_TO_ARTIST,
              })
              .returning();
            if (booking) {
              await tx.insert(eventCollaborators).values({
                eventId: inserted.id,
                artistProfileId: ap.userId,
                bookingId: booking.id,
              });
              // Matrix A-09 — Venue invited Artist (booking is PENDING here).
              pendingDispatches.push({
                trigger: NotificationTrigger.BOOKING_INVITE_TO_ARTIST,
                recipientUserId: ap.userId,
                vars: {
                  bookingId: booking.id,
                  venueName: venueProfile.venueName,
                  artistName: ap.stageName,
                  eventTitle: inserted.title,
                  date: formatNotificationDate(inserted.dateStart),
                },
              });
            }
          }
        }
      } else {
        // ── Artist → Artist (new) ──
        const creatorProfile = await tx.query.artistProfiles.findFirst({
          where: eq(artistProfiles.userId, ctx.userId),
          columns: { id: true, stageName: true },
        });
        if (creatorProfile) {
          for (const ap of inviteProfiles) {
            const [booking] = await tx
              .insert(bookings)
              .values({
                artistId: ap.id,
                inviterArtistId: creatorProfile.id,
                venueId: null,
                eventId: inserted.id,
                status: BookingStatus.PENDING,
                direction: BookingDirection.ARTIST_TO_ARTIST,
              })
              .returning();
            if (booking) {
              await tx.insert(eventCollaborators).values({
                eventId: inserted.id,
                artistProfileId: ap.userId,
                bookingId: booking.id,
              });
              pendingDispatches.push({
                trigger: NotificationTrigger.BOOKING_INVITE_TO_COARTIST,
                recipientUserId: ap.userId,
                vars: {
                  bookingId: booking.id,
                  coArtistName: creatorProfile.stageName,
                  eventTitle: inserted.title,
                  date: formatNotificationDate(inserted.dateStart),
                },
              });
            }
          }
        }
      }
    }

    // Artist tags a registered venue → create a PENDING request the venue must
    // accept. The event stays pending_review until then; the venue sees the
    // request under Requests, and accepting it (bookings.update) flips the event
    // live. Mirrors the venue→artist invite rule. (Asana 1215189395180422)
    if (!isVenue && eventData.venueId) {
      const venueProfile = await tx.query.venueProfiles.findFirst({
        where: eq(venueProfiles.id, eventData.venueId),
        columns: { id: true, userId: true, venueName: true },
      });

      const artistProfile = await tx.query.artistProfiles.findFirst({
        where: eq(artistProfiles.userId, ctx.userId),
        columns: { id: true, stageName: true },
      });

      if (venueProfile && artistProfile) {
        const [booking] = await tx
          .insert(bookings)
          .values({
            artistId: artistProfile.id,
            venueId: venueProfile.id,
            eventId: inserted.id,
            status: BookingStatus.PENDING,
            direction: BookingDirection.ARTIST_TO_VENUE,
          })
          .returning();

        if (booking) {
          // Link both participants to the pending booking. confirmedEvents only
          // surfaces rows whose booking is accepted, so neither side shows this
          // as confirmed until the venue accepts.
          await tx.insert(eventCollaborators).values([
            {
              eventId: inserted.id,
              artistProfileId: ctx.userId,
              bookingId: booking.id,
            },
            {
              eventId: inserted.id,
              venueProfileId: venueProfile.id,
              bookingId: booking.id,
            },
          ]);

          // V-09 — Venue received a booking request from the artist.
          pendingDispatches.push({
            trigger: NotificationTrigger.BOOKING_REQUEST_TO_VENUE,
            recipientUserId: venueProfile.userId,
            vars: {
              bookingId: booking.id,
              venueName: venueProfile.venueName,
              artistName: artistProfile.stageName,
              eventTitle: inserted.title,
              date: formatNotificationDate(inserted.dateStart),
            },
          });
        }
      }
    }

    // Promo post — a live representation of the event in the social feed, created
    // only when the creator opted in (shareToFeed). Held-for-approval events start
    // hidden and are revealed on venue acceptance; visibility otherwise tracks the
    // event via the deleted_at toggles (status) + the read-time expiry filter.
    if (shareToFeed) {
      await tx.insert(posts).values({
        eventId: inserted.id,
        createdBy: ctx.userId,
        caption: inserted.title,
        mediaType: inserted.coverImage ? 'image' : 'text',
        mediaUrl: inserted.coverImage ?? null,
        deletedAt: heldForVenueApproval ? new Date() : null,
      });
    }

    return inserted;
  });

  // Fire all collected dispatches after the transaction commits — a rollback
  // would leave us with phantom inbox rows + push notifications otherwise.
  await Promise.all(pendingDispatches.map((d) => ctx.dispatchNotification(d)));
  await flushInviteEmails(pendingInviteEmails);

  // Sync to Typesense so the event appears on map/feed immediately. Skip while
  // held for venue approval — a pending_review event must stay off the map/feed
  // until the venue accepts (bookings.update syncs it then). Non-blocking, but
  // we must NOT swallow the error silently: a failed sync means a live event is
  // invisible, so the cause needs to surface in logs for ops to act on.
  if (event.status === EventStatus.ACTIVE) {
    await syncEventToTypesense(event).catch((err: unknown) => {
      console.warn(
        `[events.create] Typesense sync failed for event ${event.id} — it will not appear on map/feed until re-synced:`,
        err instanceof Error ? `${err.name}: ${err.message}` : err
      );
    });
  }

  return event;
});

export const update = protectedProcedure
  .input(updateEventSchema)
  .mutation(async ({ input, ctx }) => {
    const event = await db.query.events.findFirst({
      where: eq(events.id, input.id),
    });

    if (!event) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
    }

    if (event.createdBy !== ctx.userId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only edit your own events' });
    }

    if (event.status === EventStatus.ARCHIVED) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot edit an archived event' });
    }

    const { platformInvites, unregisteredCollaborators, ...updateData } = input.data;
    const isVenue = ctx.session.user.currentRole === UserRole.VENUE;

    // Ad fields are venue-only — strip them for non-venue creators
    if (!isVenue) {
      updateData.adTitle = undefined;
      updateData.adDescription = undefined;
    }

    // An artist adding/switching to a registered venue on edit must get that
    // venue's consent, exactly like create: hold the event at pending_review and
    // raise a pending request. Dropping the venue from a held event releases it
    // back to active. (Asana 1215189395180422)
    const addsRegisteredVenue =
      !isVenue &&
      updateData.venueId !== undefined &&
      updateData.venueId !== null &&
      updateData.venueId !== event.venueId;
    const releasesHeldVenue =
      !isVenue &&
      !addsRegisteredVenue &&
      event.status === EventStatus.PENDING_REVIEW &&
      updateData.venueId !== undefined &&
      updateData.venueId !== event.venueId;

    // Resolve coordinates: an explicit pin always wins; otherwise, if the
    // creator switches to a different registered venue, inherit that venue's
    // stored pin so the event's location stays consistent. Never write (0,0).
    let resolvedCoords: { lat: string; lng: string } | null = null;
    if (updateData.lat !== undefined && updateData.lng !== undefined) {
      resolvedCoords = { lat: updateData.lat.toString(), lng: updateData.lng.toString() };
      // Clearing the venue (explicit null) leaves the existing pin alone — there is
      // no venue left to inherit coordinates from.
    } else if (
      updateData.venueId !== undefined &&
      updateData.venueId !== null &&
      updateData.venueId !== event.venueId
    ) {
      const venue = await lookupVenueCoords(updateData.venueId);
      if (venue && venue.lat !== null && venue.lng !== null) {
        resolvedCoords = { lat: venue.lat, lng: venue.lng };
      }
    }

    // Collected inside the transaction; fired after commit so a rollback
    // doesn't leave us with phantom notifications.
    const pendingDispatches: DispatchNotificationInput[] = [];
    // Outside-platform invite emails, likewise flushed after commit.
    const pendingInviteEmails: PendingInviteEmail[] = [];

    const updated = await db.transaction(async (tx) => {
      // Build the update object — only set provided fields
      const setValues: Record<string, unknown> = { updatedAt: new Date() };
      if (updateData.title !== undefined) setValues.title = updateData.title;
      if (updateData.description !== undefined) setValues.description = updateData.description;
      if (updateData.coverImage !== undefined) setValues.coverImage = updateData.coverImage;
      if (updateData.dateStart !== undefined) setValues.dateStart = new Date(updateData.dateStart);
      if (updateData.dateEnd !== undefined) setValues.dateEnd = new Date(updateData.dateEnd);
      if (resolvedCoords) {
        setValues.lat = resolvedCoords.lat;
        setValues.lng = resolvedCoords.lng;
      }
      if (updateData.venueId !== undefined) setValues.venueId = updateData.venueId;
      if (updateData.venueAddress !== undefined) setValues.venueAddress = updateData.venueAddress;
      if (updateData.category !== undefined) setValues.category = updateData.category;
      if (updateData.ticketLink !== undefined) setValues.ticketLink = updateData.ticketLink;
      if (updateData.ticketPrice !== undefined) setValues.ticketPrice = updateData.ticketPrice;
      if (updateData.collectionId !== undefined) setValues.collectionId = updateData.collectionId;
      if (updateData.adTitle !== undefined) setValues.adTitle = updateData.adTitle;
      if (updateData.adDescription !== undefined)
        setValues.adDescription = updateData.adDescription;

      // If event was removed by admin and creator is resubmitting, re-activate
      // and stamp resubmittedAt so the moderation page can surface it.
      const isResubmit = event.status === EventStatus.REMOVED;
      if (isResubmit) {
        setValues.status = EventStatus.ACTIVE;
        setValues.removalReason = null;
        setValues.resubmittedAt = new Date();
      }

      // Hold for venue approval / release back to live based on the venue change.
      if (addsRegisteredVenue) {
        setValues.status = EventStatus.PENDING_REVIEW;
      } else if (releasesHeldVenue) {
        setValues.status = EventStatus.ACTIVE;
      }

      const rows = await tx
        .update(events)
        .set(setValues)
        .where(eq(events.id, input.id))
        .returning();

      const result = rows[0];
      if (!result) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Update failed' });

      // Keep the linked promo post in sync — content mirrors the event, and
      // visibility follows its live state (hidden unless active). No-op when the
      // event has no promo post (created with "Share to feed" off).
      await syncPromoPost(tx, result.id, {
        hidden: result.status !== EventStatus.ACTIVE,
        content: { title: result.title, coverImage: result.coverImage },
      });

      if (isResubmit) {
        // Matrix A-16 / V-15 — confirm resubmission to the creator. Queued
        // here, fired post-commit alongside any collaborator dispatches.
        pendingDispatches.push({
          trigger: isVenue
            ? NotificationTrigger.EVENT_RESUBMITTED_TO_VENUE
            : NotificationTrigger.EVENT_RESUBMITTED_TO_ARTIST,
          recipientUserId: ctx.userId,
          vars: {
            eventId: result.id,
            eventTitle: result.title,
          },
        });
      }

      // Artist added/switched a registered venue → cancel any prior pending venue
      // request and raise a fresh one. The event is already held at pending_review
      // (setValues above); accepting the request later flips it live.
      if (addsRegisteredVenue && updateData.venueId) {
        const venueProfile = await tx.query.venueProfiles.findFirst({
          where: eq(venueProfiles.id, updateData.venueId),
          columns: { id: true, userId: true, venueName: true },
        });
        const artistProfile = await tx.query.artistProfiles.findFirst({
          where: eq(artistProfiles.userId, ctx.userId),
          columns: { id: true, stageName: true },
        });

        if (venueProfile && artistProfile) {
          await cancelPendingVenueRequest(tx, input.id, ctx.userId);

          const [booking] = await tx
            .insert(bookings)
            .values({
              artistId: artistProfile.id,
              venueId: venueProfile.id,
              eventId: input.id,
              status: BookingStatus.PENDING,
              direction: BookingDirection.ARTIST_TO_VENUE,
            })
            .returning();

          if (booking) {
            await tx.insert(eventCollaborators).values([
              { eventId: input.id, artistProfileId: ctx.userId, bookingId: booking.id },
              { eventId: input.id, venueProfileId: venueProfile.id, bookingId: booking.id },
            ]);

            pendingDispatches.push({
              trigger: NotificationTrigger.BOOKING_REQUEST_TO_VENUE,
              recipientUserId: venueProfile.userId,
              vars: {
                bookingId: booking.id,
                venueName: venueProfile.venueName,
                artistName: artistProfile.stageName,
                eventTitle: result.title,
                date: formatNotificationDate(result.dateStart),
              },
            });
          }
        }
      } else if (releasesHeldVenue) {
        // Venue dropped from a held event → withdraw the pending request; the
        // event is released to active by setValues above + Typesense sync below.
        await cancelPendingVenueRequest(tx, input.id, ctx.userId);
      }

      // Confirmed collaborators are no longer set from the event form — a venue
      // performer becomes confirmed only by accepting a pending invite through
      // the booking flow. Edits therefore never touch confirmed collaborator
      // rows; existing ones (incl. legacy auto-confirmed performers) are left
      // intact. Only the invite paths below are managed here.

      // Update non-platform (invited) collaborators — replace all on edit, but
      // only EMAIL the newly-added invitees. The form re-sends the full invite
      // list on every edit, so naively emailing every row would re-spam everyone
      // each time the venue tweaks an unrelated field. Invitees already on the
      // event keep their existing token + expiry; only genuinely new emails get a
      // fresh token and an invite email.
      if (unregisteredCollaborators !== undefined) {
        // Existing invited-only rows (artistProfileId IS NULL), keyed by email so
        // we can tell "already invited" from "newly added".
        const existingInvited = await tx.query.eventCollaborators.findMany({
          where: and(
            eq(eventCollaborators.eventId, input.id),
            sql`${eventCollaborators.artistProfileId} IS NULL`
          ),
          columns: { id: true, invitedEmail: true, inviteToken: true, inviteTokenExpiresAt: true },
        });
        if (existingInvited.length > 0) {
          await tx.delete(eventCollaborators).where(
            inArray(
              eventCollaborators.id,
              existingInvited.map((r) => r.id)
            )
          );
        }

        if (unregisteredCollaborators.length > 0) {
          const priorByEmail = new Map(
            existingInvited.filter((r) => r.invitedEmail).map((r) => [r.invitedEmail as string, r])
          );

          const rows = unregisteredCollaborators.map((invite) => {
            const email = canonicalEmail(invite.email);
            const prior = priorByEmail.get(email);
            const inviteToken = prior?.inviteToken ?? randomUUID();
            return {
              isNew: !prior,
              inviteToken,
              row: {
                eventId: input.id,
                invitedName: invite.name,
                invitedEmail: email,
                invitedImageUrl: invite.imageUrl ?? null,
                inviteToken,
                inviteTokenExpiresAt:
                  prior?.inviteTokenExpiresAt ?? new Date(Date.now() + INVITE_TOKEN_TTL_MS),
              },
            };
          });

          await tx.insert(eventCollaborators).values(rows.map((r) => r.row));

          const newRows = rows.filter((r) => r.isNew);
          if (newRows.length > 0) {
            const inviterName = await resolveInviterName(tx, ctx.userId, isVenue);
            for (const r of newRows) {
              pendingInviteEmails.push({
                to: r.row.invitedEmail,
                inviterName,
                eventTitle: result.title,
                eventDate: formatNotificationDate(result.dateStart),
                inviteUrl: inviteUrl(r.inviteToken),
              });
            }
          }
        }
      }

      // Platform invites — reconcile the submitted list against the event's
      // current invites: create pending bookings for newly invited artists and
      // withdraw the pending invites the creator removed from the field. The
      // field is pre-populated on edit (events.byId.platformInvites), so a sent
      // list that drops an artist means "withdraw that invite". (Asana 1215912673233456)
      //
      // Venue → VENUE_TO_ARTIST (performer invite); artist → ARTIST_TO_ARTIST
      // (co-artist invite). Self is excluded; already-collaborating artists are
      // skipped so re-saving never duplicates an invite; only *pending* invites
      // are removable (an accepted performer's booking is cancelled through the
      // booking flow, never silently here).
      if (platformInvites !== undefined) {
        const inviteDirection = isVenue
          ? BookingDirection.VENUE_TO_ARTIST
          : BookingDirection.ARTIST_TO_ARTIST;

        // Everything already linked to the event (any status) — skip on add.
        const existingCollabs = await tx.query.eventCollaborators.findMany({
          where: eq(eventCollaborators.eventId, input.id),
          columns: { artistProfileId: true },
        });
        const existingCollaboratorUserIds = existingCollabs
          .map((c) => c.artistProfileId)
          .filter((id): id is string => id !== null);

        // The creator's still-pending performer invites — the removable set.
        // Joined to their collaborator row so we have both the booking to cancel
        // and the invitee's userId to compare against the submitted list + notify.
        const pendingInviteRows = await tx
          .select({
            bookingId: bookings.id,
            inviteeUserId: eventCollaborators.artistProfileId,
          })
          .from(bookings)
          .innerJoin(eventCollaborators, eq(eventCollaborators.bookingId, bookings.id))
          .where(
            and(
              eq(bookings.eventId, input.id),
              eq(bookings.status, BookingStatus.PENDING),
              eq(bookings.direction, inviteDirection)
            )
          );
        const existingPendingInviteUserIds = pendingInviteRows
          .map((r) => r.inviteeUserId)
          .filter((id): id is string => id !== null);

        const { toAdd, toRemove } = diffPlatformInvites(
          platformInvites,
          existingCollaboratorUserIds,
          existingPendingInviteUserIds,
          ctx.userId
        );

        // Creator's display name for invite/withdraw notification copy —
        // resolved once and reused by both paths below.
        const venueProfile = isVenue
          ? await tx.query.venueProfiles.findFirst({
              where: eq(venueProfiles.userId, ctx.userId),
              columns: { id: true, venueName: true },
            })
          : null;
        const creatorProfile = !isVenue
          ? await tx.query.artistProfiles.findFirst({
              where: eq(artistProfiles.userId, ctx.userId),
              columns: { id: true, stageName: true },
            })
          : null;

        // ── Withdrawals ── cancel the pending booking + detach its collaborator
        // row (mirrors cancelPendingVenueRequest), then notify the dropped invitee.
        if (toRemove.length > 0) {
          const bookingByUserId = new Map(
            pendingInviteRows
              .filter((r) => r.inviteeUserId !== null)
              .map((r) => [r.inviteeUserId as string, r.bookingId])
          );
          for (const inviteeUserId of toRemove) {
            const bookingId = bookingByUserId.get(inviteeUserId);
            if (!bookingId) continue;
            await tx
              .update(bookings)
              .set({
                status: BookingStatus.CANCELLED,
                cancelledBy: ctx.userId,
                updatedAt: new Date(),
              })
              .where(eq(bookings.id, bookingId));
            await tx.delete(eventCollaborators).where(eq(eventCollaborators.bookingId, bookingId));

            if (isVenue && venueProfile) {
              // V-13 mirror — venue withdrew a pending invitation.
              pendingDispatches.push({
                trigger: NotificationTrigger.BOOKING_WITHDRAWN_TO_ARTIST,
                recipientUserId: inviteeUserId,
                vars: {
                  bookingId,
                  venueName: venueProfile.venueName,
                  eventTitle: result.title,
                  date: formatNotificationDate(result.dateStart),
                },
              });
            } else if (!isVenue && creatorProfile) {
              // A-13a — co-artist withdrew the invite.
              pendingDispatches.push({
                trigger: NotificationTrigger.BOOKING_COARTIST_WITHDRAWN_TO_INVITEE,
                recipientUserId: inviteeUserId,
                vars: {
                  bookingId,
                  coArtistName: creatorProfile.stageName,
                  eventTitle: result.title,
                  date: formatNotificationDate(result.dateStart),
                },
              });
            }
          }
        }

        // ── Additions ── create a pending booking for each newly invited artist.
        if (toAdd.length > 0) {
          const inviteProfiles = await tx
            .select({
              id: artistProfiles.id,
              userId: artistProfiles.userId,
              stageName: artistProfiles.stageName,
            })
            .from(artistProfiles)
            .where(inArray(artistProfiles.userId, toAdd));

          if (isVenue && venueProfile) {
            for (const ap of inviteProfiles) {
              const [booking] = await tx
                .insert(bookings)
                .values({
                  artistId: ap.id,
                  venueId: venueProfile.id,
                  eventId: input.id,
                  status: BookingStatus.PENDING,
                  direction: BookingDirection.VENUE_TO_ARTIST,
                })
                .returning();

              if (booking) {
                await tx.insert(eventCollaborators).values({
                  eventId: input.id,
                  artistProfileId: ap.userId,
                  bookingId: booking.id,
                });

                // Matrix A-09 — Venue invited Artist (booking is PENDING here).
                pendingDispatches.push({
                  trigger: NotificationTrigger.BOOKING_INVITE_TO_ARTIST,
                  recipientUserId: ap.userId,
                  vars: {
                    bookingId: booking.id,
                    venueName: venueProfile.venueName,
                    artistName: ap.stageName,
                    eventTitle: result.title,
                    date: formatNotificationDate(result.dateStart),
                  },
                });
              }
            }
          } else if (!isVenue && creatorProfile) {
            for (const ap of inviteProfiles) {
              const [booking] = await tx
                .insert(bookings)
                .values({
                  artistId: ap.id,
                  inviterArtistId: creatorProfile.id,
                  venueId: null,
                  eventId: input.id,
                  status: BookingStatus.PENDING,
                  direction: BookingDirection.ARTIST_TO_ARTIST,
                })
                .returning();

              if (booking) {
                await tx.insert(eventCollaborators).values({
                  eventId: input.id,
                  artistProfileId: ap.userId,
                  bookingId: booking.id,
                });

                // Co-artist invite — pending until the invitee accepts.
                pendingDispatches.push({
                  trigger: NotificationTrigger.BOOKING_INVITE_TO_COARTIST,
                  recipientUserId: ap.userId,
                  vars: {
                    bookingId: booking.id,
                    coArtistName: creatorProfile.stageName,
                    eventTitle: result.title,
                    date: formatNotificationDate(result.dateStart),
                  },
                });
              }
            }
          }
        }
      }

      return result;
    });

    // Sync to Typesense if event is active. Non-blocking, but log failures —
    // a silently failed sync leaves the event out of the map/feed.
    if (updated.status === EventStatus.ACTIVE) {
      await syncEventToTypesense(updated).catch((err: unknown) => {
        console.warn(
          `[events.update] Typesense sync failed for event ${updated.id}:`,
          err instanceof Error ? `${err.name}: ${err.message}` : err
        );
      });
    } else {
      await removeEventFromTypesense(updated.id).catch((err: unknown) => {
        console.warn(
          `[events.update] Typesense removal failed for event ${updated.id}:`,
          err instanceof Error ? `${err.name}: ${err.message}` : err
        );
      });
    }

    // Fire collected dispatches after the transaction commits.
    await Promise.all(pendingDispatches.map((d) => ctx.dispatchNotification(d)));
    await flushInviteEmails(pendingInviteEmails);

    return updated;
  });

export const archive = protectedProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ input, ctx }) => {
    const event = await db.query.events.findFirst({
      where: eq(events.id, input.id),
    });

    if (!event) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
    }

    if (event.createdBy !== ctx.userId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only archive your own events' });
    }

    if (event.status !== EventStatus.ACTIVE) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Only active events can be archived',
      });
    }

    const [updated] = await db
      .update(events)
      .set({ status: EventStatus.ARCHIVED, updatedAt: new Date() })
      .where(eq(events.id, input.id))
      .returning();

    await removeEventFromTypesense(input.id).catch(() => {});

    // Hide the event's promo post from the social feed now that it's archived.
    await syncPromoPost(db, input.id, { hidden: true }).catch((err: unknown) => {
      console.warn(`[events.archive] failed to hide promo post for event ${input.id}:`, err);
    });

    // Tell the linked counterparty their event was deleted. The other side of
    // any still-live booking (a venue's invited/confirmed artist, or the venue
    // an artist tagged) loses the event silently otherwise. Best-effort fan-out
    // — a dispatch outage must not fail the delete (mirrors admin/moderation).
    const linked = await db
      .select({
        artistUserId: artistProfiles.userId,
        venueUserId: venueProfiles.userId,
      })
      .from(bookings)
      .leftJoin(artistProfiles, eq(artistProfiles.id, bookings.artistId))
      .leftJoin(venueProfiles, eq(venueProfiles.id, bookings.venueId))
      .where(
        and(
          eq(bookings.eventId, input.id),
          inArray(bookings.status, [BookingStatus.PENDING, BookingStatus.ACCEPTED])
        )
      );

    const artistRecipients = new Set<string>();
    const venueRecipients = new Set<string>();
    for (const row of linked) {
      if (row.artistUserId && row.artistUserId !== ctx.userId)
        artistRecipients.add(row.artistUserId);
      if (row.venueUserId && row.venueUserId !== ctx.userId) venueRecipients.add(row.venueUserId);
    }

    const dispatches: DispatchNotificationInput[] = [
      ...[...artistRecipients].map((recipientUserId) => ({
        trigger: NotificationTrigger.EVENT_DELETED_BY_CREATOR_TO_ARTIST,
        recipientUserId,
        vars: { eventTitle: event.title },
      })),
      ...[...venueRecipients].map((recipientUserId) => ({
        trigger: NotificationTrigger.EVENT_DELETED_BY_CREATOR_TO_VENUE,
        recipientUserId,
        vars: { eventTitle: event.title },
      })),
    ];

    await Promise.all(dispatches.map((d) => ctx.dispatchNotification(d).catch(() => {})));

    return updated;
  });

// ─── My Events ───────────────────────────────────────────────────────────────

export const getMyEvents = creatorProcedure
  .input(myEventsQuerySchema)
  .query(async ({ input, ctx }) => {
    const { limit, offset } = input;

    // Archived events are a soft-delete from the creator's perspective — once
    // they delete an event it should drop out of My Events entirely (Asana
    // 1215489535915818). All other statuses (draft/pending/active/removed) stay
    // so the creator can still manage or resubmit them.
    const ownAndNotArchived = and(
      eq(events.createdBy, ctx.userId),
      ne(events.status, EventStatus.ARCHIVED)
    );

    // Date-driven "past" predicate — has the event FINISHED (lib/event-window), which
    // is the same rule as the public profile split, the map, the feed and search.
    // Shared by the select flag and the ordering below so the two can never drift, and
    // resolved against the same statement-stable now().
    const isPastExpr = eventFinished();

    const [rows, countResult] = await Promise.all([
      db
        .select({
          id: events.id,
          title: events.title,
          coverImage: events.coverImage,
          dateStart: events.dateStart,
          dateEnd: events.dateEnd,
          category: events.category,
          status: events.status,
          rejectionReason: events.rejectionReason,
          removalReason: events.removalReason,
          venueAddress: events.venueAddress,
          createdAt: events.createdAt,
          collectionName: collections.name,
          // M11-T3 — saves count for the "X Joined" badge
          joinedCount: sql<number>`(SELECT count(*)::int FROM ${savedEvents} WHERE ${savedEvents.eventId} = ${events.id})`,
          // Returned so the client can section the list without recomputing
          // "now" on its own clock.
          isPast: isPastExpr,
        })
        .from(events)
        .leftJoin(collections, eq(events.collectionId, collections.id))
        .where(ownAndNotArchived)
        .orderBy(
          // Upcoming block first, then past — a stable global order so offset
          // pagination never interleaves the two and the client's section
          // headers stay correct across pages.
          isPastExpr,
          // Within upcoming: soonest first (past rows are null here, sorted by
          // the next key). Within past: most recent first. Mirrors the public
          // profile's ordering.
          sql`CASE WHEN ${eventNotFinished()} THEN ${events.dateStart} END ASC NULLS LAST`,
          desc(events.dateStart),
          // Unique final key so the total order is deterministic — without it,
          // two events sharing a dateStart could swap between offset pages and
          // duplicate/skip at the boundary.
          events.id
        )
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(events)
        .where(ownAndNotArchived),
    ]);

    const totalCount = countResult[0]?.count ?? 0;

    return {
      events: rows.map((e) => ({
        ...e,
        dateStart: e.dateStart.toISOString(),
        dateEnd: e.dateEnd?.toISOString() ?? null,
        coverImage: e.coverImage ?? null,
        rejectionReason: e.rejectionReason ?? null,
        removalReason: e.removalReason ?? null,
        venueAddress: e.venueAddress ?? null,
        collectionName: e.collectionName ?? null,
      })),
      totalCount,
      hasNextPage: offset + limit < totalCount,
    };
  });
