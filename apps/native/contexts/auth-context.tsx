import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

import { authClient } from '@/lib/auth-client';
import { trpc } from '@/utils/trpc';

interface AuthContextType {
  user: { id: string; email: string; name?: string | null; emailVerified: boolean } | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;
  isCompletingRegistration: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: session, isPending } = authClient.useSession();
  const [isGuest, setIsGuest] = useState(false);
  const [guestLoaded, setGuestLoaded] = useState(false);
  // Gates (app)/_layout while we consume pendingRegistration on a fresh OAuth
  // session — without this, the layout briefly renders spectator UI before
  // completeRegistration flips currentRole to artist/venue.
  const [isCompletingRegistration, setIsCompletingRegistration] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync('isGuest')
      .then((val) => setIsGuest(val === 'true'))
      .catch(() => {})
      .finally(() => setGuestLoaded(true));
  }, []);

  // Consume pendingRegistration (role + consent) once a valid session appears.
  // This covers the case where verifyEmail didn't have a session yet and the
  // user had to sign in manually afterwards.
  const { mutateAsync: completeRegistration } = useMutation(
    trpc.users.completeRegistration.mutationOptions()
  );
  const queryClient = useQueryClient();
  const pendingHandled = useRef(false);
  // Bumped after a failed completeRegistration to genuinely re-run the consume
  // effect — flipping a ref alone doesn't re-trigger an effect. Capped so a
  // persistently-failing server can't loop forever.
  const [registrationRetry, setRegistrationRetry] = useState(0);
  const MAX_REGISTRATION_RETRIES = 3;

  // An authenticated user is never a guest. The "isGuest" flag is written when
  // the user taps "Skip"; it is only otherwise cleared on logout, so without
  // this reconcile a guest who later signs in would stay flagged on the next
  // app launch — disabling users.me, the onboarding redirect, FCM, and badges.
  useEffect(() => {
    if (!session?.user) return;
    setIsGuest(false);
    void SecureStore.deleteItemAsync('isGuest').catch(() => {});
  }, [session?.user]);

  useEffect(() => {
    if (!session?.user || pendingHandled.current) return;
    pendingHandled.current = true;
    // Block child routes until we know whether a role patch is needed. Cheap
    // (~SecureStore read) for returning sessions; prevents the spectator flash
    // for fresh OAuth signups.
    setIsCompletingRegistration(true);

    void (async () => {
      try {
        const raw = await SecureStore.getItemAsync('pendingRegistration');
        if (!raw) return;

        let parsed: { currentRole: 'spectator' | 'artist' | 'venue'; marketingConsent: boolean };
        try {
          parsed = JSON.parse(raw) as typeof parsed;
        } catch {
          // Corrupt SecureStore data — delete it so we don't loop forever
          await SecureStore.deleteItemAsync('pendingRegistration').catch(() => {});
          return;
        }

        try {
          await completeRegistration({
            currentRole: parsed.currentRole,
            marketingConsent: parsed.marketingConsent,
          });
          // Refetch users.me so (app)/_layout sees the freshly-written role and
          // routes to artist/venue-onboarding instead of the cached spectator default.
          await queryClient.invalidateQueries({ queryKey: trpc.users.me.queryKey() });
          await SecureStore.deleteItemAsync('pendingRegistration');
        } catch (err) {
          // Network / server error — keep pendingRegistration and retry.
          // Logging the error makes silent failures visible during testing.
          console.warn('[auth-context] completeRegistration failed', err);
          if (registrationRetry < MAX_REGISTRATION_RETRIES) {
            // Reset the guard AND bump the counter so the effect actually
            // re-runs (the counter is a dependency); the ref alone wouldn't.
            pendingHandled.current = false;
            setTimeout(() => setRegistrationRetry((n) => n + 1), 2000);
          }
        }
      } finally {
        setIsCompletingRegistration(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user, registrationRetry]);

  const user = session?.user
    ? {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        emailVerified: session.user.emailVerified,
      }
    : null;

  const logout = async () => {
    await authClient.signOut();
    await SecureStore.deleteItemAsync('isGuest');
    // AuthProvider is mounted once at the app root and never unmounts on
    // logout, so this teardown must be explicit. Without it, the next account
    // signed into during the same app run keeps stale registration state:
    //   - pendingHandled gates the consume-pendingRegistration effect to run
    //     once per process, so a second social signup never gets its chosen
    //     role applied and silently falls back to the `spectator` column
    //     default (BetterAuth can't set additionalFields via signIn.social).
    //   - a leftover pendingRegistration could otherwise be applied to the
    //     wrong account.
    pendingHandled.current = false;
    setRegistrationRetry(0);
    await SecureStore.deleteItemAsync('pendingRegistration');
    setIsGuest(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        // Defensive: an authenticated user is never a guest, regardless of any
        // not-yet-reconciled stale flag (see the reconcile effect above).
        isGuest: isGuest && !user,
        isLoading: isPending || !guestLoaded,
        isCompletingRegistration,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
