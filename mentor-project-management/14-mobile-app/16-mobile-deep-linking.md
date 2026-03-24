# Mobile Deep Linking

## Description

Implement universal links (iOS) and app links (Android) configuration with schema routing to course details, lesson playback, community posts, payment success/cancel, email verification, and profile screens. Enable seamless navigation from external sources (email, notifications, web links) to app screens.

## Affected Apps/Packages

- `apps/mobile/src/navigation/linking.ts` (updated)
- `apps/mobile/app.config.ts` (updated)
- iOS: `ios/Mentor/Info.plist` (new)
- Android: `android/app/AndroidManifest.xml` (updated)

## Requirements

### 1. Deep Link Configuration in app.json

File: `app.config.ts` (updated)

```typescript
import { ExpoConfig, ConfigContext } from "expo/config";

const IS_PRODUCTION = process.env.APP_VARIANT === "production";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,

  scheme: ["mentor", "mentor"],

  ios: {
    bundleIdentifier: IS_PRODUCTION
      ? "com.example.mentor"
      : "com.example.mentor.dev",

    // Associate domains for universal links
    associatedDomains: [
      "applinks:example.com",
      "applinks:mentor.example.com",
      "applinks:api.example.com",
    ],

    supportsTabletMode: true,
  },

  android: {
    package: IS_PRODUCTION ? "com.example.mentor" : "com.example.mentor.dev",

    // Intent filters for app links
    intentFilters: [
      {
        action: "android.intent.action.VIEW",
        autoVerify: true,
        data: [
          {
            scheme: "https",
            host: "example.com",
            pathPrefix: "/",
          },
          {
            scheme: "https",
            host: "mentor.example.com",
            pathPrefix: "/",
          },
          {
            scheme: "https",
            host: "api.example.com",
            pathPrefix: "/mobile",
          },
        ],
        category: [
          "android.intent.category.DEFAULT",
          "android.intent.category.BROWSABLE",
        ],
      },
    ],
  },
});
```

### 2. Linking Configuration

File: `src/navigation/linking.ts`

```typescript
import { LinkingOptions } from "@react-navigation/native";
import { RootStackParamList } from "./types";

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    // Custom scheme (fallback)
    "mentor://",
    "mentor://",

    // Universal links (iOS)
    "https://example.com",
    "https://mentor.example.com",

    // App links (Android)
    "https://example.com",
    "https://mentor.example.com",
  ],

  config: {
    screens: {
      // Auth screens
      Auth: {
        screens: {
          SignIn: "auth/signin",
          SignUp: "auth/signup",
          ForgotPassword: "auth/forgot-password",
          EmailVerification: "auth/verify/:email/:code",
          SocialLogin: "auth/social",
        },
      },

      // Main app
      Main: {
        screens: {
          // Home tab
          home: {
            screens: {
              Home: "",
              CourseDetail: "courses/:courseId",
              LessonPlayer: "lessons/:lessonId",
              BookmarkedCourses: "bookmarks",
            },
          },

          // Search tab
          search: {
            screens: {
              SearchResults: "search",
            },
          },

          // My Courses tab
          "my-courses": {
            screens: {
              MyCourses: "my-courses",
              CourseDetail: "courses/:courseId",
              LessonPlayer: "lessons/:lessonId",
              Assignments: "assignments/:assignmentId",
            },
          },

          // Community tab
          community: {
            screens: {
              Feed: "community",
              PostDetail: "posts/:postId",
              ComposeFeed: "community/compose",
            },
          },

          // Profile tab
          profile: {
            screens: {
              Profile: "profile",
              EditProfile: "profile/edit",
              Settings: "settings",
              NotificationPreferences: "settings/notifications",
              DataExport: "settings/data-export",
              DeleteAccount: "settings/delete-account",
            },
          },
        },
      },

      // Modal screens (shared across tabs)
      Modal: {
        screens: {
          Transcripts: "transcripts/:lessonId",
          Bookmarks: "bookmarks",
          Filters: "filters",
          ComposePost: "compose",
          Guidelines: "guidelines",
        },
      },

      // Special routes
      PaymentSuccess: "payments/success/:sessionId",
      PaymentCancel: "payments/cancel/:sessionId",
      InstructorProfile: "instructors/:instructorId",
      UserProfile: "users/:userId",
      CourseReviews: "courses/:courseId/reviews",

      // Catch-all for unmatched routes
      NotFound: "*",
    },
  },
};

export default linking;
```

### 3. iOS Universal Links Configuration

File: `ios/Mentor/Info.plist` (updated)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <!-- ... other properties ... -->

  <!-- Associated Domains for Universal Links -->
  <key>com.apple.developer.associated-domains</key>
  <array>
    <string>applinks:example.com</string>
    <string>applinks:mentor.example.com</string>
    <string>applinks:api.example.com</string>
    <string>webcredentials:example.com</string>
  </array>

  <!-- URL Schemes for deep linking -->
  <key>CFBundleURLTypes</key>
  <array>
    <dict>
      <key>CFBundleTypeRole</key>
      <string>Editor</string>
      <key>CFBundleURLName</key>
      <string>com.example.mentor</string>
      <key>CFBundleURLSchemes</key>
      <array>
        <string>mentor</string>
        <string>mentor</string>
      </array>
    </dict>
  </array>

  <!-- Query schemes for checking if other apps are installed -->
  <key>LSApplicationQueriesSchemes</key>
  <array>
    <string>instagram</string>
    <string>twitter</string>
    <string>fb</string>
  </array>

</dict>
</plist>
```

### 4. Android App Links Configuration

File: `android/app/AndroidManifest.xml` (updated)

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.example.mentor">

    <uses-permission android:name="android.permission.INTERNET" />
    <!-- ... other permissions ... -->

    <application>
        <!-- Main activity with deep link intent filters -->
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTask">

            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>

            <!-- App Links (HTTPS) - Auto verified -->
            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="example.com" />
                <data android:scheme="https" android:host="mentor.example.com" />
                <data android:scheme="https" android:host="api.example.com" />
            </intent-filter>

            <!-- Custom scheme deep links (Fallback) -->
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="mentor" />
                <data android:scheme="mentor" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

### 5. Web Server Configuration (.well-known)

File: `public/.well-known/apple-app-site-association` (on web server)

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAM_ID.com.example.mentor",
        "paths": [
          "/auth/*",
          "/courses/*",
          "/lessons/*",
          "/community/*",
          "/profile/*",
          "/settings/*",
          "/payments/*",
          "/posts/*",
          "/users/*",
          "/instructors/*"
        ]
      }
    ]
  },
  "webcredentials": {
    "apps": ["TEAM_ID.com.example.mentor"]
  }
}
```

### 6. Android Digital Asset Links

File: `public/.well-known/assetlinks.json` (on web server)

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.example.mentor",
      "sha256_cert_fingerprints": [
        "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99"
      ]
    }
  }
]
```

### 7. Deep Link Handler Hook

File: `src/hooks/useDeepLinkHandler.ts`

```typescript
import { useEffect, useCallback } from "react";
import { Linking } from "react-native";
import { useNavigation } from "@react-navigation/native";

export function useDeepLinkHandler() {
  const navigation = useNavigation();

  const handleDeepLink = useCallback(
    (url: string) => {
      // Parse URL and extract route information
      const parsed = parseDeepLink(url);

      if (!parsed) {
        return;
      }

      const { screen, params } = parsed;

      // Navigate to appropriate screen
      navigation.navigate(screen as any, params);
    },
    [navigation],
  );

  // Handle deep link when app is launched
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });
  }, [handleDeepLink]);

  // Handle deep link when app is running
  useEffect(() => {
    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleDeepLink(url);
    });

    return () => subscription.remove();
  }, [handleDeepLink]);

  return { handleDeepLink };
}

interface ParsedDeepLink {
  screen: string;
  params: Record<string, any>;
}

function parseDeepLink(url: string): ParsedDeepLink | null {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    const searchParams = parsed.searchParams;

    // Parse course detail
    if (pathname.match(/^\/courses\/[a-z0-9-]+$/i)) {
      const courseId = pathname.split("/")[2];
      return {
        screen: "CourseDetail",
        params: { courseId },
      };
    }

    // Parse lesson player
    if (pathname.match(/^\/lessons\/[a-z0-9-]+$/i)) {
      const lessonId = pathname.split("/")[2];
      const courseId = searchParams.get("courseId");
      return {
        screen: "LessonPlayer",
        params: { lessonId, courseId },
      };
    }

    // Parse community post
    if (pathname.match(/^\/posts\/[a-z0-9-]+$/i)) {
      const postId = pathname.split("/")[2];
      return {
        screen: "PostDetail",
        params: { postId },
      };
    }

    // Parse payment success
    if (pathname.startsWith("/payments/success/")) {
      const sessionId = pathname.split("/")[3];
      const courseId = searchParams.get("courseId");
      return {
        screen: "PaymentSuccess",
        params: { sessionId, courseId },
      };
    }

    // Parse payment cancel
    if (pathname.startsWith("/payments/cancel/")) {
      const sessionId = pathname.split("/")[3];
      return {
        screen: "PaymentCancel",
        params: { sessionId },
      };
    }

    // Parse email verification
    if (pathname.match(/^\/auth\/verify\/[a-z0-9@.-]+\/[a-z0-9]+$/i)) {
      const parts = pathname.split("/");
      const email = parts[3];
      const code = parts[4];
      return {
        screen: "EmailVerification",
        params: { email, code },
      };
    }

    // Parse instructor profile
    if (pathname.match(/^\/instructors\/[a-z0-9-]+$/i)) {
      const instructorId = pathname.split("/")[2];
      return {
        screen: "InstructorProfile",
        params: { instructorId },
      };
    }

    // Parse user profile
    if (pathname.match(/^\/users\/[a-z0-9-]+$/i)) {
      const userId = pathname.split("/")[2];
      return {
        screen: "UserProfile",
        params: { userId },
      };
    }

    return null;
  } catch (error) {
    console.error("Failed to parse deep link:", error);
    return null;
  }
}
```

### 8. Testing Deep Links

File: Scripts for testing

```bash
#!/bin/bash

# iOS Universal Link Testing
# Test from Safari
open "https://example.com/courses/abc123"
open "https://mentor.example.com/lessons/lesson-1"

# Test from Notes app
# Manually add links and tap

# iOS Custom Scheme Testing
xcrun simctl openurl booted "mentor://courses/abc123"
xcrun simctl openurl booted "mentor://lessons/lesson-1"

# Android App Link Testing
adb shell am start -W -a android.intent.action.VIEW \
  -d "https://example.com/courses/abc123" \
  com.example.mentor

# Android Custom Scheme Testing
adb shell am start -W -a android.intent.action.VIEW \
  -d "mentor://courses/abc123" \
  com.example.mentor

# Verify App Links Verification Status (Android)
adb shell pm get-app-links com.example.mentor
```

## Acceptance Criteria

- [ ] Universal links work on iOS
- [ ] App links work on Android
- [ ] Custom schemes fallback on both platforms
- [ ] Course detail deep links navigate correctly
- [ ] Lesson player deep links with resume position work
- [ ] Payment success/cancel deep links route to confirmation
- [ ] Email verification deep links pre-fill email/code
- [ ] Community post deep links open detail view
- [ ] User profile deep links work
- [ ] Instructor profile deep links work
- [ ] Deep links work from notifications
- [ ] Deep links work from emails
- [ ] Deep links work from web pages
- [ ] Query parameters preserved in navigation
- [ ] No console errors
- [ ] Links from killed app state work

## Dependencies

- @react-navigation/native (linking support)
- react-native (Linking API)

## Technical Notes

### iOS Requirements

- Team ID required for app links
- Certificate fingerprint needed
- .well-known files on HTTPS server
- DNS propagation time: 24-48 hours

### Android Requirements

- SHA-256 cert fingerprint from keystore
- assetlinks.json on /.well-known path
- Automatic verification via Play Services
- Test with: `adb shell pm get-app-links PACKAGE`

### Deep Link Best Practices

- Always use HTTPS for universal/app links
- Fallback to custom schemes for older devices
- Test on real devices (simulator may not verify)
- Include fallback web page for non-app users
- Log all deep link navigation

### Email Links

Generate links in email templates:

```
https://example.com/auth/verify/user@example.com/code123
https://example.com/payments/success/sess_123?courseId=abc
```

### Query Parameters

Support standard query params for context:

```
?courseId=abc&tab=curriculum
?returnUrl=/my-courses
?utm_source=email&utm_campaign=welcome
```
