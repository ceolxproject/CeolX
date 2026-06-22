/**
 * Summary line for a collaboration request card that represents more than one
 * attempt at the same event (e.g. requested → withdrawn → requested again).
 *
 * The server collapses repeat attempts into one card and reports `requestCount`
 * + `lastRequestedAt` (Asana 1215700058851996, Issue 1). A single attempt needs
 * no extra line, so this returns `null` for counts <= 1.
 *
 * e.g. `formatRequestAttempts(2, iso)` → "Requested 2 times · Last on Apr 15, 2026"
 */
export function formatRequestAttempts(
  requestCount: number,
  lastRequestedAt: string
): string | null {
  if (requestCount <= 1) return null;
  const date = new Date(lastRequestedAt).toLocaleString('en-IE', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `Requested ${requestCount} times · Last on ${date}`;
}
