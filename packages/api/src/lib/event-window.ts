import { sql } from 'drizzle-orm';

import { events } from '@CeolX/db/schema/events';

/**
 * When an event stops being worth showing.
 *
 * One definition, because "upcoming" was previously written inline as
 * `date_start > now()` in seven places and every one of them was wrong in the same
 * way: an event vanished from the map, the feed and search **the moment it began**.
 * A gig running 20:00–23:00 was visible at 19:59 and gone at 20:01, while it was
 * actually on. A festival running 10–14 August disappeared from the 11th onwards.
 * `date_end` existed on the row and in the search index the whole time; nothing
 * ever read it (Asana — map pointers QA, 11/08/2026).
 *
 * The rule is "has it finished", not "has it started". `date_end` is nullable —
 * a single-evening gig has no end time — so a missing end falls back to the start,
 * which restores the old behaviour for exactly the events it was already correct for.
 *
 * Not used by `feed-ads`, which deliberately windows on `date_start`: an ad for an
 * event starting in twenty minutes is the point of that query.
 */
export function eventNotFinished() {
  return sql`coalesce(${events.dateEnd}, ${events.dateStart}) > now()`;
}

/**
 * The inverse — an event that has run its course.
 *
 * Kept beside its opposite so the two cannot drift into disagreeing about the same
 * instant, which is what a profile page needs: every event belongs to exactly one of
 * the "upcoming" and "past" sections, with none appearing twice or vanishing.
 */
export function eventFinished() {
  return sql<boolean>`coalesce(${events.dateEnd}, ${events.dateStart}) <= now()`;
}
