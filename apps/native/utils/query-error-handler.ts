import { emitSessionExpired } from './session-events';
import { getTRPCErrorCode } from './trpc-error';

/**
 * QueryCache.onError handler. Runs for every failed *query* (not mutations —
 * those keep their own per-call-site handling). A tRPC UNAUTHORIZED means the
 * session died server-side while the app was foregrounded (e.g. password change
 * on another device, GDPR anonymisation sweep) — the AppState bridge can't see
 * that, so this is the backstop that signs the user out. Every other error
 * (FORBIDDEN, NOT_FOUND, network) is left to the query's own consumers.
 */
export function handleQueryError(error: unknown): void {
  if (getTRPCErrorCode(error) === 'UNAUTHORIZED') {
    emitSessionExpired();
  }
}
