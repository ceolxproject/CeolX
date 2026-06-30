import * as IntentLauncher from 'expo-intent-launcher';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

// Intent.FLAG_ACTIVITY_NEW_TASK (0x10000000) — required to launch another
// app's task (the email client) from our process on Android.
const FLAG_ACTIVITY_NEW_TASK = 0x10000000;

// iOS inbox-specific URL schemes, registered by each app in its Info.plist.
// `mailto:` is deliberately excluded — it means "compose", not "open inbox".
const IOS_INBOX_SCHEMES = ['message://', 'googlegmail://', 'ms-outlook://'];

/**
 * Common Android email-app package names, tried in order after CATEGORY_APP_EMAIL.
 * Must be mirrored by <queries><package> entries in the manifest (see
 * plugins/with-android-email-queries.cjs) — Android 11+ package visibility
 * otherwise hides these from getLaunchIntentForPackage and the launch fails.
 */
export const ANDROID_EMAIL_PACKAGES = [
  'com.google.android.gm', // Gmail
  'com.microsoft.office.outlook', // Outlook
  'com.samsung.android.email.provider', // Samsung Email
  'com.yahoo.mobile.client.android.mail', // Yahoo Mail
  'ch.protonmail.android', // Proton Mail
  'com.fsck.k9', // K-9 Mail
  'me.bluemail.mail', // BlueMail
];

/**
 * Open the device's email inbox. Returns `true` if an email app was launched,
 * `false` if every strategy failed (the caller then shows a manual-open hint).
 *
 * Android uses a fallback chain because a single ACTION_MAIN + CATEGORY_APP_EMAIL
 * intent is not reliable: not every email client / OEM build declares that
 * category, so on some devices it throws ActivityNotFoundException and nothing
 * opens (Asana 1215960893303593). We try the category first (covers stock
 * Android / Gmail), then launch known email apps directly by package name.
 *
 * `os` is injectable for testing; it defaults to the real platform.
 */
export async function openEmailApp(os: typeof Platform.OS = Platform.OS): Promise<boolean> {
  if (os === 'ios') {
    for (const scheme of IOS_INBOX_SCHEMES) {
      try {
        await Linking.openURL(scheme);
        return true;
      } catch {
        // No app handles this scheme — try the next one.
      }
    }
    return false;
  }

  // Android — strategy 1: the default email inbox via CATEGORY_APP_EMAIL.
  // Categorized intents can't go through Linking.openURL, and startActivity
  // isn't subject to Android 11+ package-visibility rules.
  try {
    await IntentLauncher.startActivityAsync('android.intent.action.MAIN', {
      category: 'android.intent.category.APP_EMAIL',
      flags: FLAG_ACTIVITY_NEW_TASK,
    });
    return true;
  } catch {
    // No app advertises CATEGORY_APP_EMAIL on this device — try direct launch.
  }

  // Android — strategy 2: directly launch the first installed known email app.
  for (const pkg of ANDROID_EMAIL_PACKAGES) {
    try {
      IntentLauncher.openApplication(pkg);
      return true;
    } catch {
      // Not installed (or not visible) — try the next package.
    }
  }

  return false;
}
