// Marketing version, the single source of truth. `standard-version` (pnpm
// release) bumps apps/native/package.json; reading it here means there's no
// separate "update the Expo version" step. The version never reaches the
// runtimeVersion hash — fingerprint.config.js skips ExpoConfigVersions — so a
// release bumps the store version without orphaning binaries from OTAs.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pkg = require('./package.json');

const rawVariant = process.env.APP_VARIANT;
const isCI =
  process.env.CI === 'true' ||
  process.env.EAS_BUILD === 'true' ||
  process.env.GITHUB_ACTIONS === 'true';

// In CI a missing APP_VARIANT must fail loudly — otherwise the bundle is built
// with production config (bundle id, server URL, Google client) by accident.
// Set it via the EAS build-profile env (eas.json) or export it in the workflow
// step. Locally (not CI) it still defaults to production for convenience.
if (!rawVariant && isCI) {
  throw new Error(
    'APP_VARIANT must be set when evaluating app.config.js in CI (expected "development", "staging" or "production").'
  );
}

// Locally defaults to `development` (mentor parity — the dev client uses the
// dev identity). CI always sets APP_VARIANT explicitly via eas.json / workflow.
const VARIANT = rawVariant ?? 'development';

// Per-variant identity: display name, bundle/package id, Firebase config files,
// and the Expo org + EAS project the build belongs to. Production uses bare
// filenames; other variants are suffixed. Missing files fail prebuild by design,
// so a stale APP_VARIANT can't silently fall through to another environment's
// Firebase config.
//
// Expo ownership is split per variant: dev + staging live on the RaftLabs org
// (shared project 222e34aa, different OTA channels); production lives on the
// client's `ceol_x` org as a SEPARATE project with its own credentials, OTA
// lineage, and store listings. `owner` + `projectId` + `updates.url` must all
// point at the same org/project, so they're resolved together from here.
const RAFTLABS_PROJECT_ID = '222e34aa-8637-46cc-8cc1-666ccec22b71';
// TODO: fill in after `APP_VARIANT=production eas init` mints the ceol_x project.
// Any member with Developer role (or higher) on ceol_x can run this — Owner/Admin
// is only needed for the org's billing/paid plan, not for creating the project.
const CEOLX_PROJECT_ID = 'fba52ffe-7650-4df7-beee-8f0ec518885f';

const VARIANT_CONFIG = {
  development: {
    name: 'CeolX (Dev)',
    bundleId: 'com.ceolx.app.dev',
    androidGoogleServices: './google-services.development.json',
    iosGoogleServices: './GoogleService-Info.development.plist',
    owner: 'raftlabs_expo',
    projectId: RAFTLABS_PROJECT_ID,
  },
  staging: {
    name: 'CeolX (Staging)',
    bundleId: 'com.ceolx.app.staging',
    androidGoogleServices: './google-services.staging.json',
    iosGoogleServices: './GoogleService-Info.staging.plist',
    owner: 'raftlabs_expo',
    projectId: RAFTLABS_PROJECT_ID,
  },
  production: {
    name: 'CeolX',
    bundleId: 'com.ceolx.app',
    androidGoogleServices: './google-services.json',
    iosGoogleServices: './GoogleService-Info.plist',
    owner: 'ceol_x',
    projectId: CEOLX_PROJECT_ID,
  },
};

const variantConfig = VARIANT_CONFIG[VARIANT];
if (!variantConfig) {
  throw new Error(
    `Unknown APP_VARIANT "${VARIANT}" (expected "development", "staging" or "production").`
  );
}

// While CEOLX_PROJECT_ID is still the `<new-ceol_x-id>` placeholder, treat the
// variant as unlinked: omit extra.eas.projectId and disable updates. This lets
// `APP_VARIANT=production eas init` create + link a fresh project instead of
// choking on the placeholder ("Invalid UUID appId"). Once the real UUID is
// pasted in, both fields activate automatically.
const hasProjectId = !variantConfig.projectId.startsWith('<');

// REVERSED_CLIENT_ID from the iOS OAuth client (see GoogleService-Info.plist),
// e.g. com.googleusercontent.apps.1234-abc. Registers the URL scheme the native
// Google Sign-In SDK uses on iOS. Until it's set, the google-signin config
// plugin is skipped so prebuild keeps working; Android sign-in still wires up
// via @react-native-firebase/app + google-services.json.
const GOOGLE_IOS_URL_SCHEME = process.env.GOOGLE_IOS_URL_SCHEME;

// Host the OS verifies Universal Links (iOS) / App Links (Android) against for
// shared post URLs. Defaults to the prod marketing domain; staging sets
// EXPO_PUBLIC_SHARE_BASE_URL to the staging server's Vercel URL (no custom
// domain off prod). MUST match SHARE_BASE_URL in hooks/use-share-post.ts so the
// shared link's host is the one declared here. Stripped to a bare host because
// associatedDomains / intentFilters take a host, not a URL.
const SHARE_BASE_URL = process.env.EXPO_PUBLIC_SHARE_BASE_URL ?? 'https://ceolx.com';
const SHARE_HOST = SHARE_BASE_URL.replace(/^https?:\/\//, '').replace(/\/.*$/, '');

/**
 * @param {import('expo/config').ConfigContext} _ctx
 * @returns {import('expo/config').ExpoConfig}
 */
export default (_) => ({
  name: variantConfig.name,
  slug: 'ceolx',
  // Per-variant Expo org (dev/staging → raftlabs_expo, production → ceol_x).
  // slug is scoped per-org, so raftlabs_expo/ceolx and ceol_x/ceolx are distinct
  // projects that can share the same slug.
  owner: variantConfig.owner,
  version: pkg.version,
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  scheme: 'ceolx',
  splash: {
    image: './assets/images/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  assetBundlePatterns: ['**/*'],
  runtimeVersion: { policy: 'fingerprint' },
  // OTA endpoint is resolved by EAS project id, so it must match the variant's
  // org/project (raftlabs project for dev/staging, ceol_x project for prod).
  updates: {
    url: hasProjectId ? `https://u.expo.dev/${variantConfig.projectId}` : undefined,
    enabled: hasProjectId,
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: variantConfig.bundleId,
    usesAppleSignIn: true,
    // Firebase iOS SDK (loaded by @react-native-firebase/app) is what makes
    // expo-notifications.getDevicePushTokenAsync() return an FCM token instead
    // of a raw APNs token. The plist is downloaded from the Firebase Console
    // and gitignored — see docs/project-management/M7-T1 human handoff checklist.
    googleServicesFile: process.env.GOOGLE_SERVICES_INFO_PLIST ?? variantConfig.iosGoogleServices,
    // Universal Links target (SHARE_HOST — prod ceolx.com, staging the server
    // Vercel URL). The matching apple-app-site-association is served at
    // https://<host>/.well-known/apple-app-site-association by the Hono backend
    // (apps/server/src/routes/app-links.ts). appID = APPLE_OAUTH_TEAM_ID + the
    // build's bundle id (MOBILE_BUNDLE_ID on the server), scoped to /post/*.
    associatedDomains: [`applinks:${SHARE_HOST}`],
    infoPlist: {
      // CeolX only uses standard HTTPS/TLS (exempt encryption). Declaring this
      // skips the per-build "Missing Compliance" prompt in TestFlight/App Store
      // Connect. Set to true only if you add non-exempt/custom cryptography.
      ITSAppUsesNonExemptEncryption: false,
      // Also set by the expo-location plugin (locationWhenInUsePermission), which
      // overwrites this at prebuild — keep the two strings identical so neither drifts.
      NSLocationWhenInUseUsageDescription:
        'CeolX uses your location to show music events happening near you — for example, gigs and sessions in your county this week.',
      NSCameraUsageDescription:
        'CeolX uses your camera so you can record videos and take photos to share — for example, filming a clip of your performance to post to your profile.',
      NSPhotoLibraryUsageDescription:
        'CeolX accesses your photo library so you can upload images and videos to your profile and events — for example, choosing a cover photo for a gig you are promoting.',
      NSMicrophoneUsageDescription:
        'CeolX uses your microphone to capture sound while you record videos to share — for example, the audio of a live gig you post to your profile.',
      NSAppTransportSecurity: {
        NSAllowsLocalNetworking: true,
      },
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/images/android-icon-foreground.png',
      // Solid brand purple behind the logo. A flat color (vs a background PNG)
      // can't drift out of registration with the foreground and is what the
      // app-icon design in Figma specifies (#662FFE).
      backgroundColor: '#662FFE',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    package: variantConfig.bundleId,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? variantConfig.androidGoogleServices,
    config: {
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
      },
    },
    permissions: [
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.CAMERA',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.RECORD_AUDIO',
      // "Add to calendar" on event detail (expo-calendar).
      'android.permission.READ_CALENDAR',
      'android.permission.WRITE_CALENDAR',
    ],
    // App Links for shared post URLs (host = SHARE_HOST). Verified against
    // assetlinks.json served at https://<host>/.well-known/assetlinks.json by
    // the Hono backend (apps/server/src/routes/app-links.ts). The published
    // SHA-256 (ANDROID_SHA256_CERT_FINGERPRINT on the server) must match this
    // build's signing keystore — `eas credentials -p android` → SHA-256. The
    // staging app uses a different package + keystore than prod, so its server
    // must publish the staging package's SHA-256.
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          { scheme: 'https', host: SHARE_HOST, pathPrefix: '/post' },
          { scheme: 'https', host: SHARE_HOST, pathPrefix: '/event' },
          { scheme: 'https', host: SHARE_HOST, pathPrefix: '/u' },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  web: {
    bundler: 'metro',
  },
  plugins: [
    'expo-font',
    // Peer of posthog-react-native — the SDK reads the device locale for the
    // $locale event property. `expo install` can't append to a dynamic config,
    // so this entry is added by hand.
    'expo-localization',
    // Mux HLS video playback in PostCard / post detail (M10-T2). expo-video
    // plays .m3u8 streams natively on iOS + Android; no background playback or
    // picture-in-picture needed for V1, so the bare plugin string is enough.
    'expo-video',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'CeolX uses your location to show Irish music events happening near you — for example, gigs and sessions in your county this week.',
      },
    ],
    'expo-secure-store',
    // FCM stack (M7-T1, mentor pattern): @react-native-firebase/app loads the
    // Firebase iOS SDK so expo-notifications.getDevicePushTokenAsync() returns
    // an FCM token. We do NOT install /messaging — its `use_frameworks!
    // :linkage => :static` requirement breaks iOS builds on RN 0.83's prebuilt
    // React-Core xcframework. expo-notifications gives us the listeners +
    // permission flow without that constraint.
    '@react-native-firebase/app',
    // Firebase Swift pods (FirebaseCoreInternal) depend on GoogleUtilities, which
    // is non-modular Obj-C. Without this, `pod install` fails on `expo prebuild`.
    './plugins/with-modular-headers.cjs',
    // <queries> for common email apps so the verify-email "Open Email App" button
    // can launch them directly when no app declares CATEGORY_APP_EMAIL (Android
    // 11+ package visibility — Asana 1215960893303593).
    './plugins/with-android-email-queries.cjs',
    'expo-notifications',
    'expo-apple-authentication',
    // Native Google Sign-In. The config plugin only needs to register the iOS
    // URL scheme; the native module is autolinked and reads its Android OAuth
    // client from google-services.json (applied by @react-native-firebase/app).
    ...(GOOGLE_IOS_URL_SCHEME
      ? [['@react-native-google-signin/google-signin', { iosUrlScheme: GOOGLE_IOS_URL_SCHEME }]]
      : []),
    [
      'react-native-maps',
      {
        androidGoogleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
      },
    ],
    '@react-native-community/datetimepicker',
    // "Add to calendar" on event detail. The plugin writes the iOS usage
    // strings (incl. iOS 17 full-access key); Android READ/WRITE_CALENDAR are
    // declared in android.permissions above.
    [
      'expo-calendar',
      {
        calendarPermission: 'CeolX adds events you choose to your device calendar.',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    eas: hasProjectId ? { projectId: variantConfig.projectId } : {},
    appVariant: VARIANT,
  },
});
