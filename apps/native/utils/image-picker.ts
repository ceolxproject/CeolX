// expo-image-picker does not resolve under ESLint's projectService when
// moduleResolution is set to "bundler" (Expo's default). The unsafe rules are
// scoped off for this file only (see eslint.config.js). All public functions
// return explicit TypeScript types so every caller stays lint-clean.

import {
  launchImageLibraryAsync,
  PermissionStatus,
  requestMediaLibraryPermissionsAsync,
} from 'expo-image-picker';

export type PhotoPermissionResult = { granted: boolean; canAskAgain: boolean };

export async function requestPhotoLibraryPermission(): Promise<PhotoPermissionResult> {
  const { status, canAskAgain } = await requestMediaLibraryPermissionsAsync();
  return { granted: status === PermissionStatus.GRANTED, canAskAgain };
}

/** Opens the square image picker. Returns the selected URI or null if cancelled. */
export async function pickSquarePhoto(): Promise<string | null> {
  const result = await launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });
  if (result.canceled) return null;
  return result.assets[0]?.uri ?? null;
}
