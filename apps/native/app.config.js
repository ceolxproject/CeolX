const VARIANT = process.env.APP_VARIANT ?? 'production';
const IS_STAGING = VARIANT === 'staging';

const PROD_BUNDLE_ID = 'ie.ceolx.app';
const STAGING_BUNDLE_ID = 'com.raftlabs.ceolx.staging';

/**
 * @param {import('expo/config').ConfigContext} _ctx
 * @returns {import('expo/config').ExpoConfig}
 */
export default (_) => ({
  name: IS_STAGING ? 'CeolX (Staging)' : 'CeolX',
  slug: 'ceolx',
  owner: 'raftlabs_expo',
  version: '1.0.0',
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
    // Universal Links target. Activation requires `apple-app-site-association`
    // hosted at https://ceolx.ie/.well-known/apple-app-site-association — tracked
    // with the M10-T1 / admin-redirect work; until then, in-app `ceolx://post/...`
    // still routes correctly.
    associatedDomains: ['applinks:ceolx.ie'],
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
      backgroundImage: './assets/images/android-icon-background.png',
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
    ],
    // App Links for shared post URLs. Full verification requires
    // assetlinks.json hosted at https://ceolx.ie/.well-known/assetlinks.json
    // (pending admin-app work).
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'https', host: 'ceolx.ie', pathPrefix: '/post' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  web: {
    bundler: 'metro',
  },
  plugins: [
    'expo-font',
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
    'expo-notifications',
    'expo-apple-authentication',
    [
      'react-native-maps',
      {
        androidGoogleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
      },
    ],
    '@react-native-community/datetimepicker',
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
