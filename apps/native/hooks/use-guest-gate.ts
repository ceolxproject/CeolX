import { router } from 'expo-router';

import { appToast } from '@/components/AppToast';
import { useAuth } from '@/contexts/auth-context';

/**
 * A guest ("Skip sign-in") has no session, so any auth-only action or screen
 * just 401s. This centralises the nudge so the copy and the sign-in route stay
 * consistent everywhere a guest hits a gated tap (follow buttons, follower /
 * following lists, …).
 *
 * - `promptSignIn(title?)` — toast + route to sign-in. For handlers with their
 *   own logic (e.g. the optimistic follow toggle).
 * - `guard(action, title?)` — wraps a signed-in-only handler; a guest is nudged
 *   to sign-in instead of running it. For simple navigations.
 */
export function useGuestGate() {
  const { isAuthenticated } = useAuth();

  const promptSignIn = (title = 'Sign in to continue') => {
    appToast.info(title, 'Log in or create an account to continue.');
    router.push('/(auth)/sign-in');
  };

  const guard = (action: () => void, title?: string) => () => {
    if (isAuthenticated) return action();
    promptSignIn(title);
  };

  return { isAuthenticated, promptSignIn, guard };
}
