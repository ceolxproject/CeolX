import { TRPCError } from '@trpc/server';
import { and, count, desc, eq, ilike } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';
import { events } from '@CeolX/db/schema/events';
import {
  EventStatus,
  NotificationTrigger,
  UserRole,
  adminEventListQuerySchema,
  adminRemoveEventSchema,
} from '@CeolX/shared';

import type { DispatchNotificationInput } from '../../context';
import { adminProcedure } from '../../index';
import { removeEventFromTypesense } from '../../services/event-sync';

// Post-publication moderation (PRD: MoM 3rd Apr 2026, Section 4).
// Events go live immediately on creation; admins remove inappropriate
// content with a mandatory reason. Resubmit (REMOVED → ACTIVE) is handled
// by the creator-side events.update mutation, which fires A-16/V-15.

export const listEvents = adminProcedure
  .input(adminEventListQuerySchema)
  .query(async ({ input }) => {
    const filters = [eq(events.status, input.status)];
    if (input.persona) {
      filters.push(eq(user.currentRole, input.persona));
    }
    if (input.q) {
      filters.push(ilike(events.title, `%${input.q}%`));
    }
    const whereClause = filters.length === 1 ? filters[0] : and(...filters);

    const rows = await db
      .select({
        id: events.id,
        title: events.title,
        coverImage: events.coverImage,
        description: events.description,
        dateStart: events.dateStart,
        lat: events.lat,
        lng: events.lng,
        venueAddress: events.venueAddress,
        status: events.status,
        removalReason: events.removalReason,
        createdAt: events.createdAt,
        createdBy: events.createdBy,
        creatorName: user.name,
        creatorPersona: user.currentRole,
      })
      .from(events)
      .leftJoin(user, eq(user.id, events.createdBy))
      .where(whereClause)
      .orderBy(desc(events.createdAt))
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
        lat: row.lat,
        lng: row.lng,
        venueAddress: row.venueAddress,
        status: row.status,
        removalReason: row.removalReason,
        createdAt: row.createdAt,
        creator: {
          id: row.createdBy,
          name: row.creatorName,
          persona: row.creatorPersona,
        },
      })),
      total,
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

    // Best-effort fan-out: a transient dispatch failure should not block the
    // moderation action; mirrors the pattern in events/crud.ts.
    const dispatch: DispatchNotificationInput = {
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
    await ctx.dispatchNotification(dispatch).catch(() => {});

    await removeEventFromTypesense(result.id).catch(() => {});

    return result;
  });
