// Pure, React-free helpers for the event form wizard. Extracted here so the
// cross-field date/time rules can be unit-tested without mounting the hook
// (mirrors the ArtistSearchRow.utils.ts convention).

/**
 * Merge a Date (date portion) with a Date (time portion) into an ISO-8601
 * datetime string. Returns undefined when either part is missing.
 */
export function combineDateAndTime(date: Date | null, time: Date | null): string | undefined {
  if (!date || !time) return undefined;

  const combined = new Date(date);
  combined.setHours(time.getHours(), time.getMinutes(), time.getSeconds(), 0);
  return combined.toISOString();
}

/**
 * Cross-field rule for step 2: the event's end datetime must not fall before
 * its start datetime. Mirrors the server's `dateEnd >= dateStart` refine in
 * createEventSchema so the user sees the failure inline under End Time on
 * step 2 — instead of only via the final schema check, which used to surface
 * the error keyed to `dateEnd` (a field nothing renders) and bounce them to
 * step 1 where no date field is even shown.
 *
 * The form has no end-date picker, so `dateEnd` defaults to `dateStart` and
 * the comparison is effectively end-time vs start-time on the same day.
 *
 * Returns undefined when valid — or when a required part is missing, since
 * those gaps are reported by the dateStart / startTime required rules instead.
 */
export function endDateTimeError(
  dateStart: Date | null,
  startTime: Date | null,
  dateEnd: Date | null,
  endTime: Date | null
): string | undefined {
  if (!endTime) return undefined;

  const startISO = combineDateAndTime(dateStart, startTime);
  const endISO = combineDateAndTime(dateEnd ?? dateStart, endTime);

  if (startISO && endISO && endISO < startISO) {
    return 'End time must be after start time';
  }
  return undefined;
}
