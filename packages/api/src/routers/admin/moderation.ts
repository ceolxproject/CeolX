import { TRPCError } from '@trpc/server';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  lte,
  or,
  sql,
} from 'drizzle-orm';

import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';
import { bookings } from '@CeolX/db/schema/bookings';
import { eventCollaborators, events, savedEvents } from '@CeolX/db/schema/events';
import {
  EventStatus,
  NotificationTrigger,
  UserRole,
  adminEventListQuerySchema,
  adminRemoveEventSchema,
  adminRestoreEventSchema,
  endOfDay,
} from '@CeolX/shared';

import type { DispatchNotificationInput } from '../../context';
import { adminProcedure } from '../../index';
import { AdminAuditAction, AdminAuditTargetType, logAdminAction } from '../../services/admin-audit';
import { removeEventFromTypesense, syncEventToTypesense } from '../../services/event-sync';
import { syncPromoPost } from '../../services/promo-post';

// Post-publication moderation (PRD: MoM 3rd Apr 2026, Section 4).
// Events go live immediately on creation; admins remove inappropriate
// content with a mandatory reason. Resubmit (REMOVED → ACTIVE) is handled
// by the creator-side events.update mutation, which fires A-16/V-15.
//
// M4-T3 additions on top of M9-T2:
//   • admin_audit_log row on every remove / restore
//   • U-03 saver cascade — every user who saved a removed event is notified
//   • admin.restoreEvent — silent restore (no creator notification)
//   • category surfaced on listEvents

const SORT_COLUMNS = {
  createdAt: events.createdAt,
  dateStart: events.dateStart,
  title: events.title,
} as const;

export const listEvents = adminProcedure
  .input(adminEventListQuerySchema)
  .query(async ({ input }) => {
    // No status → the "All" view: every moderation status, but never drafts /
    // pending / rejected (not used in V1 moderation).
    // resubmitted is a virtual filter — it queries events with a resubmittedAt
    // timestamp (creator resubmitted after admin removal). Not an actual status.
    const filters = [
      input.status === 'resubmitted'
        ? isNotNull(events.resubmittedAt)
        : input.status
          ? eq(events.status, input.status)
          : inArray(events.status, ['active', 'removed', 'archived']),
    ];
    if (input.persona) {
      filters.push(eq(user.currentRole, input.persona));
    }
    if (input.q) {
      const term = `%${input.q}%`;
      // Title OR creator name OR free-text venue address — one event is found
      // by what it's called, who posted it, or where it's held.
      const search = or(
        ilike(events.title, term),
        ilike(user.name, term),
        ilike(events.venueAddress, term)
      );
      if (search) filters.push(search);
    }
    if (input.category?.length) {
      filters.push(inArray(events.category, input.category));
    }
    if (input.createdFrom) {
      filters.push(gte(events.createdAt, new Date(input.createdFrom)));
    }
    if (input.createdTo) {
      filters.push(lte(events.createdAt, endOfDay(input.createdTo)));
    }
    if (input.createdBy) {
      filters.push(eq(events.createdBy, input.createdBy));
    }
    const whereClause = filters.length === 1 ? filters[0] : and(...filters);

    const sortCol = SORT_COLUMNS[input.sortBy];
    const orderBy = input.sortDir === 'asc' ? asc(sortCol) : desc(sortCol);

    const rows = await db
      .select({
        id: events.id,
        title: events.title,
        coverImage: events.coverImage,
        description: events.description,
        dateStart: events.dateStart,
        dateEnd: events.dateEnd,
        lat: events.lat,
        lng: events.lng,
        venueId: events.venueId,
        venueAddress: events.venueAddress,
        category: events.category,
        ticketLink: events.ticketLink,
        ticketPrice: events.ticketPrice,
        viewCount: events.viewCount,
        ticketClicks: events.ticketClicks,
        // Real engagement the admin can act on, unlike viewCount/ticketClicks
        // (not tracked until M10/M11). Performers split into confirmed vs invited
        // so the admin reads the number correctly; saves = fans who bookmarked it.
        // `confirmed` mirrors isConfirmedPerformer (events/crud.ts): a platform
        // artist whose booking is accepted, or a legacy auto-confirmed row
        // (bookingId null, pre-31/05/2026). `invited` mirrors
        // isPendingPlatformInvite + isExternalInvitee: a still-pending performer
        // invite (venue→artist or artist→artist) or an outside-platform email
        // invite. Venue-participant rows and artist→venue consent requests are
        // excluded from both — they are not performers.
        confirmedCount: sql<number>`(
          select count(*)::int from ${eventCollaborators}
          where ${eventCollaborators.eventId} = ${events.id}
            and ${eventCollaborators.artistProfileId} is not null
            and (
              ${eventCollaborators.bookingId} is null
              or exists (
                select 1 from ${bookings}
                where ${bookings.id} = ${eventCollaborators.bookingId}
                  and ${bookings.status} = 'accepted'
              )
            )
        )`,
        invitedCount: sql<number>`(
          select count(*)::int from ${eventCollaborators}
          where ${eventCollaborators.eventId} = ${events.id}
            and (
              (
                ${eventCollaborators.artistProfileId} is not null
                and exists (
                  select 1 from ${bookings}
                  where ${bookings.id} = ${eventCollaborators.bookingId}
                    and ${bookings.status} = 'pending'
                    and ${bookings.direction} in ('venue_to_artist', 'artist_to_artist')
                )
              )
              or (
                ${eventCollaborators.artistProfileId} is null
                and ${eventCollaborators.venueProfileId} is null
                and ${eventCollaborators.invitedName} is not null
              )
            )
        )`,
        savedCount: sql<number>`(select count(*)::int from ${savedEvents} where ${savedEvents.eventId} = ${events.id})`,
        status: events.status,
        removalReason: events.removalReason,
        createdAt: events.createdAt,
        updatedAt: events.updatedAt,
        createdBy: events.createdBy,
        creatorName: user.name,
        creatorPersona: user.currentRole,
      })
      .from(events)
      .leftJoin(user, eq(user.id, events.createdBy))
      .where(whereClause)
      .orderBy(orderBy)
      .limit(input.limit)
      .offset(input.offset);

    const totalRows = await db
      .select({ total: count() })
      .from(events)
      .leftJoin(user, eq(user.id, events.createdBy))
      .where(whereClause);
    const total = Number(totalRows[0]?.total ?? 0);

    return {
      events: rows.map((row) => ({
        id: row.id,
        title: row.title,
        coverImage: row.coverImage,
        description: row.description,
        dateStart: row.dateStart,
        dateEnd: row.dateEnd,
        lat: row.lat,
        lng: row.lng,
        venueId: row.venueId,
        venueAddress: row.venueAddress,
        category: row.category,
        ticketLink: row.ticketLink,
        ticketPrice: row.ticketPrice,
        viewCount: row.viewCount ?? 0,
        ticketClicks: row.ticketClicks ?? 0,
        confirmedCount: row.confirmedCount ?? 0,
        invitedCount: row.invitedCount ?? 0,
        savedCount: row.savedCount ?? 0,
        status: row.status,
        removalReason: row.removalReason,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        creator: {
          id: row.createdBy,
          name: row.creatorName,
          persona: row.creatorPersona,
        },
      })),
      total,
    };
  });

// Status totals for the moderation segment tabs. Unfiltered by the refinement
// filters — it's a top-level backlog overview ("3 removed across the platform"),
// mirroring admin.users.summary.
export const eventModerationCounts = adminProcedure.query(async () => {
  const [byStatus, resubmittedResult] = await Promise.all([
    db.select({ status: events.status, total: count() }).from(events).groupBy(events.status),
    db.select({ total: count() }).from(events).where(isNotNull(events.resubmittedAt)),
  ]);
  const byStatusMap = new Map(byStatus.map((r) => [r.status, Number(r.total)]));
  return {
    active: byStatusMap.get('active') ?? 0,
    removed: byStatusMap.get('removed') ?? 0,
    archived: byStatusMap.get('archived') ?? 0,
    resubmitted: Number(resubmittedResult[0]?.total ?? 0),
  };
});

export const removeEvent = adminProcedure
  .input(adminRemoveEventSchema)
  .mutation(async ({ input, ctx }) => {
    const lookup = await db
      .select({
        id: events.id,
        title: events.title,
        status: events.status,
        createdBy: events.createdBy,
        creatorRole: user.currentRole,
      })
      .from(events)
      .leftJoin(user, eq(user.id, events.createdBy))
      .where(eq(events.id, input.id))
      .limit(1);

    const target = lookup[0];
    if (!target || target.status !== EventStatus.ACTIVE) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Event not found or not eligible for removal',
      });
    }

    const updated = await db
      .update(events)
      .set({
        status: EventStatus.REMOVED,
        removalReason: input.removalReason,
        updatedAt: new Date(),
      })
      .where(eq(events.id, input.id))
      .returning();

    const result = updated[0];
    if (!result) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Removal failed' });
    }

    // Audit row — write before any post-commit fan-out so a dispatcher /
    // typesense outage doesn't lose the trail of what happened.
    await logAdminAction(db, {
      adminId: ctx.session.user.id,
      action: AdminAuditAction.EVENT_REMOVE,
      targetType: AdminAuditTargetType.EVENT,
      targetId: result.id,
      reason: input.removalReason,
      metadata: { creatorId: target.createdBy, creatorRole: target.creatorRole },
    }).catch((err: unknown) => {
      // Audit failure is non-blocking but very loud — moderation must be
      // observable even if the log write hits a transient error.
      console.error('[ADMIN] failed to write admin_audit_log for event.remove', err);
    });

    // Best-effort fan-out: a transient dispatch failure should not block the
    // moderation action; mirrors the pattern in events/crud.ts.
    const creatorDispatch: DispatchNotificationInput = {
      trigger:
        target.creatorRole === UserRole.VENUE
          ? NotificationTrigger.EVENT_REMOVED_BY_ADMIN_TO_VENUE
          : NotificationTrigger.EVENT_REMOVED_BY_ADMIN_TO_ARTIST,
      recipientUserId: target.createdBy,
      vars: {
        eventId: result.id,
        eventTitle: result.title,
        reason: input.removalReason,
      },
    };
    await ctx.dispatchNotification(creatorDispatch).catch(() => {});

    // U-03 saver cascade — fan out to every user who saved this event so the
    // bookmark in their feed isn't a dead link. Per-saver dispatch rather
    // than batched: at <1000 V1 users the saver count is small; switch to a
    // QStash batch job once the matrix-row volume warrants.
    const savers = await db
      .select({ userId: savedEvents.userId })
      .from(savedEvents)
      .where(eq(savedEvents.eventId, result.id));

    if (savers.length > 0) {
      await Promise.all(
        savers
          .filter((s) => s.userId !== target.createdBy)
          .map((s) =>
            ctx
              .dispatchNotification({
                trigger: NotificationTrigger.SAVED_EVENT_REMOVED_TO_SAVERS,
                recipientUserId: s.userId,
                vars: { eventId: result.id, eventTitle: result.title },
              })
              .catch(() => {})
          )
      );
    }

    await removeEventFromTypesense(result.id).catch(() => {});

    // Hide the event's promo post from the social feed while it's removed —
    // mirrors the Typesense removal above (best-effort + loud).
    await syncPromoPost(db, result.id, { hidden: true }).catch((err: unknown) => {
      console.warn(`[admin.removeEvent] failed to hide promo post for event ${result.id}:`, err);
    });

    return result;
  });

export const restoreEvent = adminProcedure
  .input(adminRestoreEventSchema)
  .mutation(async ({ input, ctx }) => {
    const lookup = await db
      .select({
        id: events.id,
        status: events.status,
        createdBy: events.createdBy,
        creatorRole: user.currentRole,
      })
      .from(events)
      .leftJoin(user, eq(user.id, events.createdBy))
      .where(eq(events.id, input.id))
      .limit(1);

    const target = lookup[0];
    if (!target || target.status !== EventStatus.REMOVED) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Event not found or not currently removed',
      });
    }

    const updated = await db
      .update(events)
      .set({
        status: EventStatus.ACTIVE,
        removalReason: null,
        updatedAt: new Date(),
      })
      .where(eq(events.id, input.id))
      .returning();

    const result = updated[0];
    if (!result) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Restore failed' });
    }

    // Reveal the event's promo post again now that it's active (best-effort).
    await syncPromoPost(db, result.id, { hidden: false }).catch((err: unknown) => {
      console.warn(`[admin.restoreEvent] failed to reveal promo post for event ${result.id}:`, err);
    });

    await logAdminAction(db, {
      adminId: ctx.session.user.id,
      action: AdminAuditAction.EVENT_RESTORE,
      targetType: AdminAuditTargetType.EVENT,
      targetId: result.id,
      reason: null,
      metadata: { creatorId: target.createdBy },
    }).catch((err: unknown) => {
      console.error('[ADMIN] failed to write admin_audit_log for event.restore', err);
    });

    // Tell the creator their event is live again. Best-effort, mirroring
    // removeEvent: a transient dispatch failure must not block the restore.
    const creatorDispatch: DispatchNotificationInput = {
      trigger:
        target.creatorRole === UserRole.VENUE
          ? NotificationTrigger.EVENT_RESTORED_BY_ADMIN_TO_VENUE
          : NotificationTrigger.EVENT_RESTORED_BY_ADMIN_TO_ARTIST,
      recipientUserId: target.createdBy,
      vars: {
        eventId: result.id,
        eventTitle: result.title,
      },
    };
    await ctx.dispatchNotification(creatorDispatch).catch(() => {});

    // Re-index in Typesense so it reappears on the map/feed immediately.
    await syncEventToTypesense(result).catch(() => {});

    return result;
  });
