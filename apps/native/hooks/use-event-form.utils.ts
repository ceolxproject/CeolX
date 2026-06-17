// Pure, React-free helpers for the event form wizard. Extracted here so the
// cross-field date/time rules can be unit-tested without mounting the hook
// (mirrors the ArtistSearchRow.utils.ts convention).

/**
 * Reduce the selected platform-artist invites (full display objects, the form's
 * single source of truth) to the array of artist IDs the create/update payload
 * expects. Returns undefined when nothing is selected so the optional
 * `platformInvites` field is omitted rather than sent as an empty array.
 *
 * The form holds the full {@link ArtistResult} objects — not just IDs — so the
 * invite chips survive a step change (the picker is unmounted between steps;
 * keeping only IDs there meant the chips vanished on back-navigation). IDs are
 * derived here, at submit time, from that persisted list.
 */
export function platformInviteIds(invites: ReadonlyArray<{ id: string }>): string[] | undefined {
  return invites.length > 0 ? invites.map((a) => a.id) : undefined;
}

/**
 * Resolve the outside-platform (email) invitees for the create/update payload.
 *
 * The server replaces ALL invited-only collaborator rows with whatever this
 * field contains — but only when it is sent (`!== undefined`). That makes the
 * absent-vs-empty distinction load-bearing on EDIT: clearing the last invited
 * artist leaves an empty array, and if we collapsed that to `undefined` (as we
 * still do on create, to omit the optional field) the server would skip the
 * replace and the removed artist would silently persist.
 *
 * So: on edit, always send the array — even empty — so removal sticks. On
 * create there is nothing to clear, so an empty selection stays omitted.
 * (Asana 1215700058851952 — external artist couldn't be removed while editing.)
 */
export function unregisteredCollaboratorsPayload<T>(
  collaborators: ReadonlyArray<T>,
  isEditing: boolean
): T[] | undefined {
  if (isEditing) return [...collaborators];
  return collaborators.length > 0 ? [...collaborators] : undefined;
}

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
