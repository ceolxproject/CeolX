import { sql } from 'drizzle-orm';

import { events } from '@CeolX/db/schema/events';

/**
 * When an event stops being worth showing: it has **finished**, not started.
 *
 * The single definition of that rule. It was written inline in nine places and every
 * one was wrong the same way — an event vanished from the map, the feed and search the
 * moment it began. A gig running 20:00–23:00 was visible at 19:59 and gone at 20:01
 * while it was on; a festival running 10–14 August disappeared from the 11th. `date_end`
 * was on the row and in the search index the whole time and nothing read it.
 * (Asana 1217270314297651, map-pointer QA 11/08/2026.)
 *
 * `date_end` is nullable — a single-evening gig has no end time — so a missing end falls
 * back to the start, which is exactly the old behaviour for the events it already suited.
 *
 * The Typesense half of the same rule lives in `routers/events/helpers.ts`
 * (`buildDateFilter`), which cannot import SQL. That is the only intentional second copy.
 *
 * Not used by `feed-ads`, which deliberately windows on `date_start`: an ad for an event
 * starting in twenty minutes is the point of that query.
 */
export function eventNotFinished() {
  // Written as an OR rather than `coalesce(date_end, date_start) >= now()` so it stays
  // sargable — wrapping the column kills the range scan on events_status_date_idx
  // (status, date_start). The two are equivalent because the `date_range_check`
  // constraint guarantees `date_end >= date_start`, so a finished end implies a past
  // start and the second disjunct can never fire on its own.
  //
  // The `is not null` guard is what keeps it three-valued-logic safe. Without it, a
  // started event with no end date yields `false or null` = NULL rather than false.
  // NULL is falsy in a WHERE so the filtering was right either way, but it would surface
  // as `null` the moment this is selected as a boolean column — which is exactly how
  // `isPastExpr` uses its counterpart.
  return sql`(${events.dateStart} >= now() or (${events.dateEnd} is not null and ${events.dateEnd} >= now()))`;
}

/**
 * The inverse — an event that has run its course.
 *
 * Kept beside its opposite so the two cannot drift into disagreeing about the same
 * instant, which is what a profile page needs: every event belongs to exactly one of the
 * "upcoming" and "past" sections, with none appearing twice or vanishing.
 */
export function eventFinished() {
  return sql<boolean>`(${events.dateStart} < now() and (${events.dateEnd} is null or ${events.dateEnd} < now()))`;
}

/**
 * JS form, for reads that have already loaded the rows.
 *
 * Boundary matches the SQL above (`>= now` counts as still on) so a screen that mixes a
 * SQL-filtered list with a JS-filtered one cannot show an event in both sections.
 */
export function isEventNotFinished(
  event: { dateStart: Date | string; dateEnd: Date | string | null },
  now: Date
): boolean {
  const end = event.dateEnd ?? event.dateStart;
  return new Date(end).getTime() >= now.getTime();
}
