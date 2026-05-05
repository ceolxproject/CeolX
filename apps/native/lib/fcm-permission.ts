import * as Notifications from 'expo-notifications';

// ─────────────────────────────────────────────────────────────────────────────
// Notification permission gate (mentor pattern §8 — expo-notifications).
//
// expo-notifications.requestPermissionsAsync handles both platforms in one
// call: iOS shows the APNs system dialog, Android 13+ triggers the
// POST_NOTIFICATIONS runtime prompt, Android 12 and below grants at install
// time and resolves immediately. No more manual PermissionsAndroid plumbing.
//
// Both 'granted' and the iOS PROVISIONAL pseudo-status (returned as
// 'granted' here) allow the app to receive notifications.
// ─────────────────────────────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === Notifications.PermissionStatus.GRANTED) return true;

  const result = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });
  return result.status === Notifications.PermissionStatus.GRANTED;
}
