const config = {
  name: 'CeolX',
  slug: 'ceolx',
  owner: 'ceolxprojects-organization',
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
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'ie.ceolx.app',
    usesAppleSignIn: true,
    // FCM via @react-native-firebase. The plist is downloaded from the
    // Firebase Console and gitignored — see docs/project-management/M7-T1
    // human handoff checklist.
    googleServicesFile: process.env.GOOGLE_SERVICES_INFO_PLIST ?? './GoogleService-Info.plist',
    // Universal Links target. Activation requires `apple-app-site-association`
    // hosted at https://ceolx.ie/.well-known/apple-app-site-association — tracked
    // with the M10-T1 / admin-redirect work; until then, in-app `ceolx://post/...`
    // still routes correctly.
    associatedDomains: ['applinks:ceolx.ie'],
    infoPlist: {
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
    package: 'ie.ceolx.app',
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
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
    // FCM stack (M7-T1): @react-native-firebase replaces expo-notifications
    // per Aravind's directive — direct FCM, no Expo proxy hop, future web
    // push reuse. iOS Firebase SDK requires static frameworks.
    '@react-native-firebase/app',
    '@react-native-firebase/messaging',
    [
      'expo-build-properties',
      {
        ios: { useFrameworks: 'static' },
      },
    ],
    'expo-apple-authentication',
    [
      'react-native-maps',
      {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
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
      projectId: '91f9219e-c91c-47f2-b55a-5ee1db979b66',
    },
  },
};

export default config;
