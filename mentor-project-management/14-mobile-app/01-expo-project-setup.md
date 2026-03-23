# Expo Project Setup

## Description

Initialize and configure the Expo mobile project with all necessary build configurations, environment setup, app identity assets, and platform-specific settings. This establishes the foundation for both iOS and Android apps with proper bundle identifiers, signing certificates, and runtime configurations.

## Affected Apps/Packages

- `apps/mobile` (new Expo project)
- `packages/shared` (shared components, hooks, utilities)
- `packages/types` (TypeScript types)
- EAS (Expo Application Services) for building and distribution

## Requirements

### 1. Create Expo Project Structure

- Initialize Expo project in `apps/mobile` using `expo init` or `create-expo-app`
- Configure as TypeScript project with Expo SDK 51+
- Set up directory structure:
  ```
  apps/mobile/
  ├── app.json                    # Expo config (static)
  ├── app.config.ts               # Expo config (dynamic)
  ├── eas.json                    # EAS Build config
  ├── src/
  │   ├── screens/
  │   ├── components/
  │   ├── navigation/
  │   ├── services/
  │   ├── hooks/
  │   ├── utils/
  │   ├── constants/
  │   ├── types/
  │   ├── theme/
  │   └── App.tsx
  ├── assets/
  │   ├── icons/
  │   ├── images/
  │   ├── fonts/
  │   └── splash/
  ├── babel.config.js
  ├── tsconfig.json
  ├── package.json
  └── .env.example
  ```

### 2. App Identity & Icons

- Create app icon with 'm' monogram for Mentor branding
  - Base icon: 1024x1024px (will be auto-scaled)
  - Design should be recognizable at small sizes
  - Background: Mentor brand color (recommend deep purple/teal)
- Generate platform-specific icon sizes:
  - iOS: AppIcon.appiconset (1024, 512, 256, 180, 167, 152, 120, 87, 80, 76, 60, 58, 40, 29, 20)
  - Android: ldpi, mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi
- Use Expo icon tool: `expo install` handles auto-scaling

### 3. Splash Screen

- Create branded splash screen:
  - Logo with Mentor branding
  - Mentor colors
  - Safe area considerations for notches
  - Size: 1242x2436px (iPhone 11 Pro)
- Configure in app.json:
  ```json
  "splash": {
    "image": "./assets/splash/splash.png",
    "resizeMode": "contain",
    "backgroundColor": "#ffffff"
  }
  ```

### 4. Environment Configuration

- Create `.env.example` with template:
  ```
  EXPO_PUBLIC_API_URL=https://api.example.com
  EXPO_PUBLIC_WEB_URL=https://example.com
  EXPO_PUBLIC_STRIPE_PUBLIC_KEY=pk_...
  EXPO_PUBLIC_MUX_TOKEN_ID=...
  EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=...
  EXPO_PUBLIC_APPLE_OAUTH_CLIENT_ID=...
  ```
- Use EAS environment variables for secrets
- Document which vars are public (prefixed `EXPO_PUBLIC_`) vs private

### 5. app.json Static Configuration

Minimal static config for Expo:

```json
{
  "expo": {
    "name": "Mentor",
    "slug": "mentor-mentor",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "assetBundlePatterns": ["**/*"],
    "ios": {
      "bundleIdentifier": "com.example.mentor"
    },
    "android": {
      "package": "com.example.mentor"
    }
  }
}
```

### 6. app.config.ts Dynamic Configuration

Handle environment-specific settings:

```typescript
import { ExpoConfig, ConfigContext } from "expo/config";

const IS_PRODUCTION = process.env.APP_VARIANT === "production";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: IS_PRODUCTION ? "Mentor" : "Mentor Dev",
  slug: "mentor-mentor",
  version: "1.0.0",

  // Environment-specific settings
  ios: {
    bundleIdentifier: IS_PRODUCTION
      ? "com.example.mentor"
      : "com.example.mentor.dev",
    supportsTabletMode: true,
    infoPlist: {
      NSLocalNetworkUsageDescription: "This app uses local network discovery",
      NSBonjourServiceTypes: ["_http._tcp"],
    },
  },

  android: {
    package: IS_PRODUCTION ? "com.example.mentor" : "com.example.mentor.dev",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
  },

  plugins: [
    // Will add plugins for FCM, video player, etc.
  ],
});
```

### 7. EAS Build Configuration

File: `eas.json`

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      },
      "ios": {
        "buildType": "simulator"
      }
    },
    "preview2": {
      "android": {
        "buildType": "apk"
      },
      "ios": {
        "buildType": "simulator"
      }
    },
    "preview3": {
      "ios": {
        "buildType": "simulator"
      }
    },
    "production": {
      "android": {
        "buildType": "aab"
      },
      "ios": {
        "buildType": "archive"
      }
    }
  },
  "submit": {
    "production": {
      "android": {
        "serviceAccount": "@env EAS_BUILD_ANDROID_KEY",
        "track": "internal"
      },
      "ios": {
        "appleId": "@env APPLE_ID",
        "ascAppId": "@env ASC_APP_ID",
        "appleTeamId": "@env APPLE_TEAM_ID"
      }
    }
  }
}
```

### 8. TypeScript Configuration

`tsconfig.json`:

```json
{
  "extends": "expo/tsconfig",
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "jsx": "react-native",
    "lib": ["es2023", "dom"],
    "moduleResolution": "node",
    "paths": {
      "@/*": ["./src/*"],
      "@components/*": ["./src/components/*"],
      "@screens/*": ["./src/screens/*"],
      "@services/*": ["./src/services/*"],
      "@hooks/*": ["./src/hooks/*"],
      "@utils/*": ["./src/utils/*"],
      "@types/*": ["./src/types/*"],
      "@shared/*": ["../../packages/shared/src/*"],
      "@types-shared/*": ["../../packages/types/src/*"]
    }
  }
}
```

### 9. Package.json Scripts

```json
{
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "eject": "expo eject",
    "prebuild": "expo prebuild --clean",
    "build:android": "eas build --platform android",
    "build:ios": "eas build --platform ios",
    "build:both": "eas build -p all",
    "submit:android": "eas submit --platform android",
    "submit:ios": "eas submit --platform ios",
    "update:metadata": "eas metadata push",
    "lint": "eslint src --ext .ts,.tsx",
    "type-check": "tsc --noEmit",
    "test": "jest"
  },
  "dependencies": {
    "expo": "^51.0.0",
    "react-native": "^0.74.0",
    "react": "^18.2.0"
  }
}
```

### 10. Firebase/FCM Integration Prep

- Configure Firebase project for Android and iOS
- Store google-services.json (Android) in version control (with sanitized keys for dev)
- Store GoogleService-Info.plist (iOS) in Xcode build settings
- Document in EAS environment setup
- Do not commit credentials to repo; use EAS secrets

### 11. Build Variants

- **Development**: `APP_VARIANT=development` - points to staging API
- **Production**: `APP_VARIANT=production` - points to production API
- Configure via EAS environment variables:
  ```
  eas secret:create --scope PROJECT --name APP_VARIANT --value development
  ```

### 12. Local Development Setup

- `expo prebuild --clean` to generate native iOS/Android projects
- Use Xcode for iOS simulator debugging
- Use Android Studio for Android emulator debugging
- Install Expo CLI globally: `npm install -g expo-cli`
- Create `.env` from `.env.example` for local dev

## Acceptance Criteria

- [ ] Expo project initialized with TypeScript in `apps/mobile`
- [ ] app.json and app.config.ts configured with dynamic environment settings
- [ ] App icon created with 'm' monogram, all sizes generated
- [ ] Splash screen asset created and configured
- [ ] Bundle identifiers set (iOS: com.example.mentor, Android: com.example.mentor)
- [ ] EAS Build and Submit configurations in place
- [ ] tsconfig.json with path aliases for shared packages
- [ ] All environment variables documented in .env.example
- [ ] Initial build successful (APK/AAB for Android, archive for iOS)
- [ ] App runs on iOS simulator and Android emulator without errors
- [ ] Build variants (dev/production) configured in EAS
- [ ] GitHub Actions workflow setup for EAS builds (if applicable)
- [ ] Documentation: setup instructions in README for developers

## Dependencies

- expo@^51.0.0
- react-native@^0.74.0
- react@^18.2.0
- @react-navigation/native (next phase)
- @react-native-community/hooks (setup phase)

## Technical Notes

### Expo SDK Versions

- Use Expo SDK 51+ for latest React Native, stability, and features
- Prebuild required for native module plugins (video player, DRM, FCM)
- EAS Build handles managed builds; prebuild generates iOS/Android projects

### Icon Generation

- Use Expo icon tool to auto-scale from 1024x1024
- Test on actual devices/simulators to ensure quality
- Consider dark mode icon variant if design system supports it

### Code Signing

- iOS: Use App Store distribution certificate (provisioning profiles via EAS)
- Android: Use Play Store keystore (store in EAS secrets, never commit)
- EAS handles code signing for production builds automatically

### OTA Updates

- Expo Updates enabled by default; plan for EAS Update service later
- Currently no OTA required; prebuild provides native binaries

### Monorepo Integration

- Mobile app shares types and components with web via packages/
- Ensure path aliases in tsconfig point to correct monorepo locations
- Install shared packages as local dependencies in package.json:
  ```json
  "@mentor/shared": "file:../../packages/shared",
  "@mentor/types": "file:../../packages/types"
  ```

### Performance Considerations

- Cold start <3s target: monitor splash screen time in App.tsx
- Minimize initial JavaScript bundle size
- Use lazy loading for routes/screens
- Profile with Expo DevTools

### Testing Strategy

- Jest for unit tests
- Detox or E2E testing framework in later phases
- Physical device testing for DRM and media features
