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
          // Network / server error — keep pendingRegistration and retry next session.
          // Logging the error makes silent failures visible during testing.
          console.warn('[auth-context] completeRegistration failed', err);
          pendingHandled.current = false;
        }
      } finally {
        setIsCompletingRegistration(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user]);

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
    setIsGuest(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isGuest,
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
