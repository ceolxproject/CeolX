import type { User, UserRole } from "@CeolX/shared";
import * as SecureStore from "expo-secure-store";
import React, { createContext, useContext, useEffect, useState } from "react";

import { authClient } from "@/lib/auth-client";

interface AuthContextType {
  user: User | null;
  sessionToken: string | null;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { data: session, isPending } = authClient.useSession();
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadToken = async () => {
      try {
        const token = await SecureStore.getItemAsync("sessionToken");
        if (token) {
          setSessionToken(token);
        }
      } catch {
        // ignore read errors
      } finally {
        setIsLoading(false);
      }
    };

    loadToken();
  }, []);

  const user: User | null = session?.user
    ? {
        userId: session.user.id,
        currentRole: ((session.user as { role?: string }).role ??
          "spectator") as UserRole,
        email: session.user.email,
        emailVerified: session.user.emailVerified,
      }
    : null;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const login = async (token: string, _user: User) => {
    setIsLoading(true);
    try {
      await SecureStore.setItemAsync("sessionToken", token);
      setSessionToken(token);
    } finally {
      setIsLoading(false);
    }
    // _user will be used in M2 when session is populated from API response
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authClient.signOut();
      await SecureStore.deleteItemAsync("sessionToken");
      setSessionToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        sessionToken,
        login,
        logout,
        isLoading: isLoading || isPending,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
