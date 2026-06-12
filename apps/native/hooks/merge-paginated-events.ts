/**
 * Merge a freshly-fetched page into an accumulated, paginated list.
 *
 *   - First page (offset 0): ALWAYS return the incoming page so in-place edits
 *     to existing rows (a replaced event cover image, an edited title/date) show
 *     up once the query cache is invalidated. The previous shape-only guard
 *     (compare list length + first id) skipped same-shape updates, which left
 *     stale content on screen until the app was restarted.
 *   - Later pages (offset > 0): append once, guarded so a re-render with the
 *     same page doesn't duplicate rows.
 *   - Returns `null` when nothing needs to change, so the caller can skip the
 *     state update (and the re-render).
 *
 * Pure and side-effect free — unit-tested without React. Shared by every
 * accumulating event-list hook (my events, saved, confirmed, feed).
 */
export function mergePaginatedEvents<T>(args: {
  offset: number;
  prev: T[];
  incoming: T[];
}): T[] | null {
  if (args.offset === 0) {
    return args.incoming;
  }
  if (args.prev.length < args.offset + args.incoming.length) {
    return [...args.prev, ...args.incoming];
  }
  return null;
}
