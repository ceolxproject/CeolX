/**
 * Maps a booking-update error into a user-friendly toast body.
 *
 * The backend's state-machine guard (packages/api/src/routers/bookings.ts)
 * throws raw messages like `Cannot transition from "cancelled" to "cancelled"`
 * when an action is no longer valid (e.g. tapping WITHDRAW twice). Those
 * internal strings must NEVER reach the user. This helper detects that family
 * of errors and returns human-readable copy, falling back to a generic message
 * for anything it doesn't recognise (network failures, unknown server errors).
 */

/** Generic fallback when we can't map the error to something more specific. */
export const BOOKING_ERROR_FALLBACK = 'Please try again.';

/**
 * Pulls the "from" (current) status out of a backend transition error message.
 * Returns null if `err` isn't a recognisable transition error.
 *
 * Backend message shape: `Cannot transition from "<from>" to "<to>"`
 */
function parseTransitionFromStatus(err: unknown): string | null {
  const message = err instanceof Error ? err.message : '';
  const match = message.match(/Cannot transition from "([^"]+)" to "([^"]+)"/);
  return match ? match[1] : null;
}

/**
 * Maps a booking-update error to user-facing toast copy.
 *
 * Only failures out of a terminal state are recognised (the backend never
 * rejects a transition out of `pending`):
 *   accepted  → cancelled            (re-accepting/rejecting fails)
 *   rejected  → (terminal)
 *   cancelled → (terminal)
 * Anything else — network errors, unknown server errors, non-Error values —
 * falls back to {@link BOOKING_ERROR_FALLBACK}.
 */
export function getBookingActionErrorBody(err: unknown): string {
  // Key off the *current* ("from") state: the backend only rejects transitions
  // out of a terminal state, so the "from" tells the user what already happened
  // to the request — regardless of which action they re-attempted.
  switch (parseTransitionFromStatus(err)) {
    case 'cancelled':
      return 'This request has already been withdrawn.';
    case 'rejected':
      return 'This request has already been declined.';
    case 'accepted':
      return 'This request has already been accepted.';
    default:
      return BOOKING_ERROR_FALLBACK;
  }
}
