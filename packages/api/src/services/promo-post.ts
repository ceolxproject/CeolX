import { and, eq, isNull, or, type SQL } from 'drizzle-orm';

import type { db } from '@CeolX/db';
import { events } from '@CeolX/db/schema/events';
import { posts } from '@CeolX/db/schema/social';
import { EventStatus } from '@CeolX/shared';

import { eventNotFinished, isEventNotFinished } from '../lib/event-window';

// Accepts either the top-level db or a transaction handle.
type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

interface PromoContent {
  title: string;
  coverImage: string | null;
}

/**
 * Keep an event's promo post in sync with the event. A promo post is a live
 * representation of its event, so:
 *  - visibility follows the event's live state (`hidden` toggles the soft-delete flag),
 *  - content (caption/media) mirrors the event when `content` is supplied.
 *
 * Matches on event_id, so it's a harmless no-op for events created without a
 * promo post (the creator left "Share to feed" off). Every event status
 * transition that changes live-state routes through here, which is why the
 * deleted_at rule lives in one place.
 */
export async function syncPromoPost(
  executor: Executor,
  eventId: string,
  opts: { hidden: boolean; content?: PromoContent }
): Promise<void> {
  const values: Partial<typeof posts.$inferInsert> = {
    deletedAt: opts.hidden ? new Date() : null,
    updatedAt: new Date(),
  };
  if (opts.content) {
    values.caption = opts.content.title;
    values.mediaType = opts.content.coverImage ? 'image' : 'text';
    values.mediaUrl = opts.content.coverImage ?? null;
  }

  await executor.update(posts).set(values).where(eq(posts.eventId, eventId));
}

/**
 * SQL predicate for post-list reads: a promo post is visible only while its
 * linked event is `active` AND upcoming. Non-promo posts (event_id null) always
 * pass. Any query using this MUST `leftJoin(events)` on posts.event_id.
 *
 * The write-time `deleted_at` toggles (syncPromoPost) hide status transitions
 * eagerly; the `status = active` clause here is the read-time backstop, so a
 * moderation takedown / archive is reflected even if that best-effort toggle
 * failed. The date clause covers expiry, which has no write-time trigger.
 *
 * `includeExpired` keeps the `status = active` backstop but drops the date
 * clause — used only when a creator views their OWN profile, so a past event's
 * promo stays as a track record for them (never for other viewers). Removed /
 * archived / pending promos stay hidden regardless (status != active, and the
 * caller still filters `deleted_at`).
 */
export function promoVisible(includeExpired = false): SQL {
  const live = includeExpired
    ? eq(events.status, EventStatus.ACTIVE)
    : and(eq(events.status, EventStatus.ACTIVE), eventNotFinished());
  return or(isNull(posts.eventId), live) as SQL;
}

/** JS form of the same expiry rule, for the relational (findFirst) reads. */
export function isPromoEventExpired(
  event: { dateStart: Date; dateEnd: Date | null } | null
): boolean {
  if (!event) return false; // not a promo post, or no linked event
  return !isEventNotFinished(event, new Date());
}
