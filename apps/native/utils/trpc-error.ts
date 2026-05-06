import { TRPCClientError } from '@trpc/client';

/** Messages that apply uniformly across all tRPC calls. */
const SHARED_MESSAGES: Partial<Record<string, string>> = {
  UNAUTHORIZED: 'Your session has expired. Please sign in again.',
  TOO_MANY_REQUESTS: 'Too many attempts. Please try again later.',
};

/** Extract the tRPC error code (e.g. 'CONFLICT', 'FORBIDDEN') from an unknown caught value. */
export function getTRPCErrorCode(err: unknown): string | undefined {
  if (!(err instanceof TRPCClientError)) return undefined;
  const data = err.data as Record<string, unknown> | undefined;
  return typeof data?.code === 'string' ? data.code : undefined;
}

/**
 * Maps a tRPC error to a user-facing message.
 *
 * Usage:
 *   setError(getTRPCErrorMessage(err, {
 *     CONFLICT: 'That name is already taken.',
 *   }));
 *
 * @param err       - The caught unknown error
 * @param overrides - Procedure-specific code → message overrides
 * @param fallback  - Returned when no code matches
 */
export function getTRPCErrorMessage(
  err: unknown,
  overrides?: Partial<Record<string, string>>,
  fallback = 'Something went wrong. Please try again.'
): string {
  const code = getTRPCErrorCode(err);
  const messages = { ...SHARED_MESSAGES, ...overrides };
  return (code !== undefined ? messages[code] : undefined) ?? fallback;
}
