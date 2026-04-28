import { createFileRoute, redirect } from '@tanstack/react-router';

import { AdminShell } from '@/components/AdminShell';
import { authClient } from '@/lib/auth-client';

async function getSessionSafely() {
  try {
    const { data } = await authClient.getSession();
    return data;
  } catch {
    // Backend offline / network error → treat as no session so we redirect
    // to /login instead of crashing the route.
    return null;
  }
}

export const Route = createFileRoute('/_admin')({
  beforeLoad: async ({ location }) => {
    const data = await getSessionSafely();

    if (!data?.user) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      });
    }

    if (data.user.currentRole !== 'admin') {
      // Authenticated but wrong role — sign out so the user can pick another
      // account, then bounce to login with a notice.
      await authClient.signOut();
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ to: '/login' });
    }
  },
  component: AdminShell,
});
