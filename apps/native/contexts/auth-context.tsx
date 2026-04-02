import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useState } from 'react';

import { authClient } from '@/lib/auth-client';

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
