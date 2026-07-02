// Marketing version, the single source of truth. `standard-version` (pnpm
// release) bumps apps/native/package.json; reading it here means there's no
// separate "update the Expo version" step. The version never reaches the
// runtimeVersion hash — fingerprint.config.js skips ExpoConfigVersions — so a
// release bumps the store version without orphaning binaries from OTAs.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pkg = require('./package.json');

const VARIANT = process.env.APP_VARIANT ?? 'production';
const IS_STAGING = VARIANT === 'staging';

const PROD_BUNDLE_ID = 'com.ceolx.app';
const STAGING_BUNDLE_ID = 'com.ceolx.app.staging';

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
  name: IS_STAGING ? 'CeolX (Staging)' : 'CeolX',
  slug: 'ceolx',
  owner: 'raftlabs_expo',
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
  updates: {
    url: 'https://u.expo.dev/222e34aa-8637-46cc-8cc1-666ccec22b71',
    enabled: true,
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: IS_STAGING ? STAGING_BUNDLE_ID : PROD_BUNDLE_ID,
    usesAppleSignIn: true,
    // Firebase iOS SDK (loaded by @react-native-firebase/app) is what makes
    // expo-notifications.getDevicePushTokenAsync() return an FCM token instead
    // of a raw APNs token. The plist is downloaded from the Firebase Console
    // and gitignored — see docs/project-management/M7-T1 human handoff checklist.
    googleServicesFile: process.env.GOOGLE_SERVICES_INFO_PLIST ?? './GoogleService-Info.plist',
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
      NSLocationWhenInUseUsageDescription:
        'CeolX uses your location to show nearby Irish music events',
      NSCameraUsageDescription: 'Upload videos of your performances',
      NSPhotoLibraryUsageDescription: 'Upload images and videos',
      NSMicrophoneUsageDescription: 'Record audio for posts',
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
    package: IS_STAGING ? STAGING_BUNDLE_ID : PROD_BUNDLE_ID,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ??
      (IS_STAGING ? './google-services.staging.json' : './google-services.json'),
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
    // Mux HLS video playback in PostCard / post detail (M10-T2). expo-video
    // plays .m3u8 streams natively on iOS + Android; no background playback or
    // picture-in-picture needed for V1, so the bare plugin string is enough.
    'expo-video',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Allow CeolX to use your location to show nearby Irish music events',
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
    eas: {
      projectId: '222e34aa-8637-46cc-8cc1-666ccec22b71',
    },
    appVariant: VARIANT,
  },
});
