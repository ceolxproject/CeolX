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
    'expo-notifications',
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
