import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

import { AnalyticsEvent, identify, resetAnalytics, track } from '@/lib/analytics';
import { authClient } from '@/lib/auth-client';
import { signOutGoogle } from '@/lib/google-signin';
import { installAppStateFocusBridge } from '@/utils/query-focus';
import { onSessionExpired, resetSessionExpired } from '@/utils/session-events';
import { trpc } from '@/utils/trpc';

interface AuthContextType {
  user: { id: string; email: string; name?: string | null; emailVerified: boolean } | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;
  isCompletingRegistration: boolean;
  continueAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: session, isPending, refetch: refetchSession } = authClient.useSession();
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
    // Re-arm the session-expiry latch: this session is valid now, so a later
    // expiry must be allowed to emit again (the latch is one-shot per cycle).
    resetSessionExpired();
    // Attach analytics to the real user. PostHog merges the anonymous
    // pre-signup person into this one, which is what makes the signup funnel
    // measurable end to end. Only ever for an authenticated session — guests
    // stay anonymous.
    identify(session.user.id);
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
          track(AnalyticsEvent.SIGNUP_COMPLETED, {
            role: parsed.currentRole,
            marketing_consent: parsed.marketingConsent,
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

  // Skip → browse as guest. Must update the in-memory state, not just
  // SecureStore: (app)/_layout reads `isGuest` from this context, and the
  // mount-time SecureStore read has already run, so a bare storage write would
  // leave the guard at `!user && !isGuest` and bounce the user back to sign-in.
  const continueAsGuest = async () => {
    await SecureStore.setItemAsync('isGuest', 'true');
    setIsGuest(true);
    track(AnalyticsEvent.GUEST_MODE_ENTERED);
  };

  const logout = async () => {
    await authClient.signOut();
    // Clear the native Google SDK's cached account too — authClient.signOut only
    // drops our BetterAuth session. Without this the SDK keeps the last Google
    // account and silently re-uses it on the next sign-in, so a user can never
    // switch to a different Google account after logging out.
    await signOutGoogle();
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
    // The queryClient is a module-level singleton that outlives logout (the
    // provider never unmounts). authClient.signOut only drops the session, so
    // the previous user's cached queries — critically users.me with their
    // currentRole — would otherwise survive. A guest who then taps "Skip" reads
    // that stale role and sees the artist/venue view until a cold restart wipes
    // the in-memory cache. Clear it here so no prior-account data leaks forward.
    queryClient.clear();
    // Same reasoning for analytics: without a reset, the next account (or guest)
    // on this device keeps the previous user's distinct id and their events —
    // and their session recordings — are attributed to the wrong person. This is
    // the single teardown path used by both the logout button and the
    // session-expiry backstop below, so one call here covers both.
    resetAnalytics();
  };

  // Backstop: a protected query that 401s (session revoked server-side while the
  // app was foregrounded) emits on the session-expiry bus. Tear the session down
  // via the SAME logout() used everywhere else — never duplicate that teardown.
  const logoutRef = useRef(logout);
  logoutRef.current = logout;
  useEffect(() => {
    const unsubscribe = onSessionExpired(() => {
      logoutRef.current().catch((err) => {
        // Logout teardown failed (e.g. authClient.signOut network error), so the
        // user is still authed on an expired session. Surface it, and re-arm the
        // latch so the NEXT 401 retries the sign-out instead of being suppressed —
        // otherwise the one-shot latch would leave the user stuck until a cold
        // start. logout()'s steps are idempotent, so a retry is safe.
        console.warn('[auth-context] session-expiry logout failed', err);
        resetSessionExpired();
      });
    });
    return unsubscribe;
  }, []);

  // Primary fix: on app resume, revalidate the session so a phantom (in-memory
  // but cookie-expired) session resolves to null and the layout guard redirects,
  // instead of sitting authed until a protected query 401s. refetchSession (from
  // useSession) updates the reactive store the redirect reads — getSession() would
  // not reliably push into that atom.
  const refetchSessionRef = useRef(refetchSession);
  refetchSessionRef.current = refetchSession;
  useEffect(() => {
    return installAppStateFocusBridge(() => {
      void refetchSessionRef.current();
    });
  }, []);

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
        continueAsGuest,
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
