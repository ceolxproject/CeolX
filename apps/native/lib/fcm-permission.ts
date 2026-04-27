import messaging from '@react-native-firebase/messaging';
import { PermissionsAndroid, Platform } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// FCM permission gate.
// iOS: messaging().requestPermission() drives the APNs system dialog and
//   returns an AuthorizationStatus enum. Both AUTHORIZED and PROVISIONAL
//   allow the app to receive notifications (PROVISIONAL = quiet inbox-only).
// Android 12 and below: notification posting is granted at install time.
// Android 13+: requires the runtime POST_NOTIFICATIONS permission, which
//   @react-native-firebase doesn't request — we use PermissionsAndroid.
// ─────────────────────────────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    const status = await messaging().requestPermission();
    return (
      status === messaging.AuthorizationStatus.AUTHORIZED ||
      status === messaging.AuthorizationStatus.PROVISIONAL
    );
  }

  if (Platform.OS === 'android') {
    if (typeof Platform.Version === 'number' && Platform.Version >= 33) {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }
    // Pre-Android-13: granted at install
    return true;
  }

  return false;
}
