import { focusManager } from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * Bridge AppState → React Query focus. On iOS the JS context survives a long
 * background, so BetterAuth's in-memory session can outlive its 7-day cookie —
 * a "phantom session" that 401s the moment a protected query fires on resume.
 * Refetching the session on foreground resolves it to null and lets the
 * existing (app)/_layout guard redirect to sign-in. This is the PRIMARY fix;
 * the QueryCache 401 handler is only the backstop.
 *
 * `onResume` is invoked on every active transition — pass the session refetch.
 * Returns a teardown that removes the AppState listener.
 */
export function installAppStateFocusBridge(onResume: () => void): () => void {
  const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
    if (status !== 'active') return;
    focusManager.setFocused(true);
    onResume();
  });
  return () => subscription.remove();
}
