# Task 6: Firebase Cloud Messaging (FCM) Push Notifications Setup

## Status

Completed. FCM push notification support is implemented across API, web apps, and mobile app.

## Current Architecture

### Backend (`packages/api`)

- Firebase Admin initialization: `packages/api/src/lib/firebase.ts`
- Push send utilities: `packages/api/src/lib/push.ts`
- Token router: `packages/api/src/routers/fcm-token.ts`
- Router registration: `packages/api/src/routers/index.ts`

### Frontend Web

- Learner setup component: `apps/web-learner/src/components/notification-setup.tsx`
- Mentor setup component: `apps/web-mentor/src/components/notification-setup.tsx`
- Learner Firebase client helpers: `apps/web-learner/src/lib/firebase.ts`
- Mentor Firebase client helpers: `apps/web-mentor/src/lib/firebase.ts`
- Service workers:
  - `apps/web-learner/public/firebase-messaging-sw.js`
  - `apps/web-mentor/public/firebase-messaging-sw.js`

### Mobile (`apps/mobile`)

- Notification helper: `apps/mobile/lib/notifications.ts`
- App-level registration setup: `apps/mobile/app/_layout.tsx`
- Logout cleanup call-site: `apps/mobile/app/(tabs)/profile.tsx`

## Environment Variables

### Server (`@mentor/env/server`)

Required for backend push delivery:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

### Web (`@mentor/env/web`)

Required for web token registration and messaging:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_VAPID_KEY`

### Mobile (`@mentor/env/native`)

- Mobile uses Expo notifications and registers the native push token through API.
- No React Native Firebase dependency is required for the current implementation.

## API Contract (TRPC/oRPC)

### `fcmTokens.register`

Input schema (`packages/validators/src/fcm-token.ts`):

- `token: string` (min length 50)
- `deviceType: "ios" | "android" | "web"`
- `deviceName?: string`

Behavior:

- Upserts token ownership when token already exists.
- Marks token as active.
- Updates `lastUsedAt`.

### `fcmTokens.unregister`

Input schema:

- `token: string`

Behavior:

- Sets `isActive = false` for the caller's token.

### `fcmTokens.list`

Behavior:

- Returns token rows for the authenticated user.

## Notification Flow

### Web

1. `NotificationSetup` registers `firebase-messaging-sw.js`.
2. Runtime Firebase config is sent to service worker via `postMessage` (`FIREBASE_CONFIG`).
3. If browser permission is already granted, app registers FCM token through `fcmTokens.register`.
4. Foreground messages are surfaced via toast.
5. Background messages are handled in service worker and shown via Notifications API.

### Mobile

1. App configures foreground notification behavior via `configureNotificationHandler`.
2. When authenticated, app requests permissions and gets native device push token.
3. Token is registered via `fcmTokens.register` with device metadata.
4. On logout, current token is unregistered with `fcmTokens.unregister`.

### Backend send path

- Business routers call `sendPushToUser` / `sendPushToUsers`.
- Utility fetches active tokens from DB and sends via Firebase Admin `messaging.sendEach`.
- Invalid/unregistered tokens are automatically deactivated.

## Q&A Integration

Q&A mutations trigger both in-app DB notifications and push notifications:

- `createQuestion` notifies course instructor
- `createAnswer` notifies question asker

Reference: `packages/api/src/routers/qanda.ts`

## Notes

- Legacy documentation that referenced `apps/api` REST endpoints and React Native Firebase setup is obsolete for this codebase.
- The source of truth for token shape and procedures is:
  - `packages/validators/src/fcm-token.ts`
  - `packages/api/src/routers/fcm-token.ts`
