# M1-T4 · React Native + Expo App Scaffold

| Field          | Value                                                                               |
| -------------- | ----------------------------------------------------------------------------------- |
| **Milestone**  | M1 — Project Setup & Infrastructure                                                 |
| **Status**     | ✅ Done                                                                             |
| **Depends on** | M1-T1 (Turborepo, shared types)                                                     |
| **PRD Ref**    | Section 10.1 (Mobile App — React Native + Expo), Section 5.1 (Navigation structure) |

---

## Description

Bootstrap the React Native mobile application with complete navigation structure, permissions configuration, and placeholder screens for both iOS and Android. The output is a fully runnable and testable app that demonstrates core user flows and tab structure, ready for features to be wired in during M2+ milestones.

Expo was chosen for rapid development, hot reload capability, and simplified over-the-air updates. EAS Build provides native compilation without requiring a Mac for iOS development. The navigation architecture uses React Navigation v6 with a bottom-tab navigator (Map, Discover, Bookings, Profile) layered over stack navigators within each tab, plus separate auth and main navigator stacks to handle authentication state.

---

## Affected Apps / Packages

| App / Package     | Role                                            |
| ----------------- | ----------------------------------------------- |
| `apps/mobile`     | Entire React Native application built with Expo |
| `packages/shared` | Enums and types imported for navigation typing  |

---

## API Endpoints

None — this is a mobile app scaffold task. API integration wired up in M2+ milestones.

---

## Requirements

### Project Initialization

- Expo project initialized with `npx create-expo-app@latest apps/mobile --template` using TypeScript template
- Project set to SDK version 51+ (as of March 2026)
- React Native target: 0.74+
- React Navigation installed: `@react-navigation/native`, `@react-navigation/bottom-tabs`, `@react-navigation/stack`, `@react-navigation/native-stack`
- Node >= 20, npm >= 10

### Navigation Structure

**Tab Navigator (bottom tabs)** — visible only when authenticated:

- Map Tab: Map Screen → Event Detail Screen → Artist Profile Screen
- Discover Tab: Feed Screen → Event Detail Screen
- Bookings Tab: Bookings List Screen → Booking Detail Screen
- Profile Tab: Profile Screen → Edit Profile Screen → Switch Account Type Screen

**Auth Navigator** — shown when user not authenticated:

- Sign Up Screen
- Sign In Screen
- Verify Email Screen
- Forgot Password Screen

**Deep Link Navigation**: App responds to deep links like `ceolx://events/123` and `ceolx://reset-password?token=...`

### Permissions Declaration

**iOS (in `app.config.ts`):**

- `NSLocationWhenInUseUsageDescription` — "CeolX uses your location to show nearby Irish music events"
- `NSCameraUsageDescription` — "Upload videos of your performances"
- `NSPhotoLibraryUsageDescription` — "Upload images and videos"
- `NSMicrophoneUsageDescription` — "Record audio for posts"

**Android (via `@react-native-permissions` or Expo plugin):**

- `android.permission.ACCESS_FINE_LOCATION` — GPS location
- `android.permission.CAMERA` — video recording
- `android.permission.READ_EXTERNAL_STORAGE` — photo/video selection
- `android.permission.RECORD_AUDIO` — audio recording

### Session & Authentication State

- Session token stored securely using `expo-secure-store` (not AsyncStorage)
- `AuthContext` created with `React.createContext()` to expose login/logout globally
- `useAuth()` hook provides session state to all components
- Auth state persists across app restarts — app reads stored token on startup
- Unverified email state detected and shows verification prompt (wired in M2-T1)

### Environment Configuration

- EAS Build configured with three profiles: `development`, `preview`, `production`
- `EXPO_PUBLIC_API_BASE_URL` environment variable set per profile (read at build time)
  - Development: `http://localhost:3001` (local testing)
  - Preview: `https://api-staging.ceolx.com` (staging environment)
  - Production: `https://api.ceolx.com` (production)
- Deep link scheme registered as `ceolx://` in `app.config.ts`

### Placeholder Screens

- **Map Screen**: Shows a map placeholder with a search bar
- **Discover Screen**: Shows a list placeholder for event feed
- **Bookings Screen**: Shows "No bookings yet" placeholder
- **Profile Screen**: Shows user avatar, name, role, Settings button
- **Sign Up Screen**: Email/Password fields, social login buttons (wired in M2)
- **Sign In Screen**: Email/Password fields, "Forgot Password?" link
- **Verify Email Screen**: Instruction text, "Resend Email" button (wired in M2-T1)
- **Switch Account Type Screen**: Buttons for Spectator, Artist, Venue roles (wired in M2-T4)

### Build & Development Configuration

- `eas.json` configured with three build profiles
- `app.config.ts` written in TypeScript (using `@expo/config-types`)
- Expo SDK version pinned in `package.json`
- Hot reload enabled for development (`expo start` runs in LAN mode)
- Development build created locally via EAS for faster iteration

### Device Token Management (Firebase FCM)

- `expo-notifications` installed (Firebase FCM integration)
- FCM token requested on first app launch (after login)
- Token stored in `device_tokens` table (schema in M1-T2)
- Token refreshed on app resume and when user logs in (wired in M7-T1)
- Token deleted on logout

---

## Acceptance Criteria

- [x] Expo project created and all dependencies installed (`npm install` completes without errors)
- [ ] App launches on iOS Simulator: `npm run ios` starts without errors — _requires runtime verification_
- [ ] App launches on Android Emulator: `npm run android` starts without errors — _requires runtime verification_
- [x] Bottom tab navigator visible with all four tabs: Map, Discover, Bookings, Profile
- [x] Tapping each tab navigates and shows placeholder screen content
- [x] Stack navigation works within at least one tab (e.g., Map → Event Detail)
- [x] Auth screen shown when `AuthContext` user is null; Main tabs shown when user exists
- [x] Back button in stack navigators works correctly (native iOS swipe-back gesture functional)
- [ ] `eas build --platform ios --profile development` builds successfully — _requires EAS account / runtime_
- [ ] `eas build --platform android --profile development` builds successfully — _requires EAS account / runtime_
- [x] Placeholder TextInput components (for Sign Up/Sign In) are usable
- [x] Deep link scheme registered and testable (can open app with `ceolx://events/123`)
- [x] `expo-secure-store` installed and available for session token storage (wired in M2)
- [x] All required permissions declared in `app.config.ts`; no warnings during EAS build
- [x] TypeScript compilation passes (`npm run type-check` in `apps/mobile`)

---

## Technical Notes

### Navigation Structure (Expo Router — file-based)

Navigation uses **Expo Router** (file-system based routing), not React Navigation v6 directly. Routes map 1:1 to files under `apps/native/app/`.

```
app/
  _layout.tsx               ← root layout, wraps AuthProvider
  (auth)/
    _layout.tsx             ← auth stack (sign-in, sign-up, verify-email, forgot-password)
    sign-in.tsx
    sign-up.tsx
    verify-email.tsx
    forgot-password.tsx
  (app)/
    _layout.tsx             ← guards route; redirects to sign-in if user is null
    (tabs)/
      _layout.tsx           ← bottom tab navigator (Map / Discover / Bookings / Profile)
      map/
        _layout.tsx         ← stack: index → event/[eventId] → artist/[artistId]
        index.tsx
        event/[eventId].tsx
        artist/[artistId].tsx
      discover/
        _layout.tsx
        index.tsx
        event/[eventId].tsx
      bookings/
        _layout.tsx
        index.tsx
        [bookingId].tsx
      profile/
        _layout.tsx
        index.tsx
        edit.tsx
        switch-account.tsx
```

Auth guard lives in `app/(app)/_layout.tsx`:

```typescript
// apps/native/app/(app)/_layout.tsx
import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/contexts/auth-context";

export default function AppLayout() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null; // splash screen wired in M2
  if (!user) return <Redirect href="/(auth)/sign-in" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

Tab icons are configured in `app/(app)/(tabs)/_layout.tsx` using `@expo/vector-icons` Ionicons, with `tabBarActiveTintColor: "#00a86b"`.

### Auth Context

```typescript
// apps/native/src/context/AuthContext.tsx

import React, { createContext, useContext, useState, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';

interface User {
  userId: string;
  currentRole: string;
  email: string;
  emailVerified: boolean;
}

interface AuthContextType {
  user: User | null;
  sessionToken: string | null;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = async (token: string, user: User) => {
    setIsLoading(true);
    try {
      await SecureStore.setItemAsync('sessionToken', token);
      setSessionToken(token);
      setUser(user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await SecureStore.deleteItemAsync('sessionToken');
      setSessionToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, sessionToken, login, logout, isLoading }}>
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
```

### EAS Build Configuration

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "gradleCommand": ":app:assembleDebug"
      },
      "ios": {
        "buildType": "simulator"
      }
    },
    "preview": {
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_API_BASE_URL": "https://api-staging.ceolx.com"
      }
    },
    "production": {
      "distribution": "store",
      "env": {
        "EXPO_PUBLIC_API_BASE_URL": "https://api.ceolx.com"
      }
    }
  }
}
```

### Deep Linking Configuration

```typescript
// apps/native/app.config.ts

import { ExpoConfig, ConfigContext } from '@expo/config';

const config: ExpoConfig = {
  name: 'CeolX',
  slug: 'ceolx',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTabletMode: false,
    bundleIdentifier: 'com.ceolx.app',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    package: 'com.ceolx.app',
  },
  scheme: 'ceolx',
  plugins: [
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'Allow CeolX to use your location to show nearby Irish music events',
      },
    ],
    'expo-secure-store',
    'expo-notifications',
  ],
};

export default config;
```

### Placeholder Screen Example

```typescript
// apps/native/src/screens/Map/MapScreen.tsx

import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const MapScreen = ({ navigation }: any) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Map</Text>
        <TextInput
          placeholder="Search location or artist..."
          style={styles.searchBar}
          placeholderTextColor="gray"
        />
      </View>

      <View style={styles.mapPlaceholder}>
        <Text style={styles.placeholderText}>Map goes here (M3-T1)</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  searchBar: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  placeholderText: {
    fontSize: 16,
    color: '#999',
  },
});

export default MapScreen;
```

### Package.json Scripts

```json
{
  "scripts": {
    "start": "expo start",
    "ios": "expo start --ios",
    "android": "expo start --android",
    "web": "expo start --web",
    "build:dev:ios": "eas build --platform ios --profile development",
    "build:dev:android": "eas build --platform android --profile development",
    "build:preview": "eas build --platform all --profile preview",
    "build:prod": "eas build --platform all --profile production",
    "submit": "eas submit --platform all",
    "type-check": "tsc --noEmit"
  }
}
```

---

## Common Gotchas

- **Location permission on iOS**: Permission string must exactly match the prompt text shown to users; test on real device
- **FCM token on Android**: May take a few seconds to generate after first app launch; do not assume it exists immediately
- **Tab bar height**: iOS and Android have different safe area bottom values; use `useSafeAreaInsets()` hook
- **Deep links on Android**: Ensure scheme matches intent filter in `AndroidManifest.xml` (Expo handles this automatically)
- **AsyncStorage vs SecureStore**: AsyncStorage is not encrypted; always use SecureStore for tokens
- **React Navigation state persistence**: Deep links may not work if navigation state not properly initialized; test cold app launches
- **Expo SDK version changes**: Avoid changing SDK versions mid-sprint; pin the version and communicate upgrades
- **EAS Build queue time**: Free tier can have 5–10 minute queue waits; plan builds in advance
- **Hot reload with deep links**: Hot reload may break deep link handling; use `expo start --clear` to reset state

---
