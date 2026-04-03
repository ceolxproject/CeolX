import { useMutation } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

import { authClient } from '@/lib/auth-client';
import { trpc } from '@/utils/trpc';

interface AuthContextType {
  user: { id: string; email: string; name?: string | null; emailVerified: boolean } | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: session, isPending } = authClient.useSession();
  const [isGuest, setIsGuest] = useState(false);
  const [guestLoaded, setGuestLoaded] = useState(false);

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
  const pendingHandled = useRef(false);

  useEffect(() => {
    if (!session?.user || pendingHandled.current) return;
    pendingHandled.current = true;

    void (async () => {
      const raw = await SecureStore.getItemAsync('pendingRegistration');
      if (!raw) return;

      try {
        const { currentRole, marketingConsent } = JSON.parse(raw) as {
          currentRole: 'spectator' | 'artist' | 'venue';
          marketingConsent: boolean;
        };
        await completeRegistration({ currentRole, marketingConsent });
        await SecureStore.deleteItemAsync('pendingRegistration');
      } catch {
        // Will retry next time a session is established
        pendingHandled.current = false;
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
