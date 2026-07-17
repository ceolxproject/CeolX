/**
 * Session-expiry event bus. A dependency-free seam between the module-level
 * QueryClient (utils/trpc.ts) and the context-level logout() (auth-context.tsx):
 * a query 401 emits here, AuthProvider subscribes and tears the session down.
 *
 * The `emitted` latch collapses a storm of near-simultaneous 401s (a batched
 * screen with several protected queries) into a single logout(). Without it,
 * N failing queries would race N logout() calls on the same SecureStore keys
 * and queryClient.clear(). Reset the latch on a fresh sign-in.
 */
type Listener = () => void;

const listeners = new Set<Listener>();
let emitted = false;

export function onSessionExpired(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function emitSessionExpired(): void {
  if (emitted) return;
  emitted = true;
  for (const cb of listeners) cb();
}

export function resetSessionExpired(): void {
  emitted = false;
}
