import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging as getMessagingFromAdmin, type Messaging } from 'firebase-admin/messaging';

// ─────────────────────────────────────────────────────────────────────────────
// firebase-admin singleton — lazy init so the server boots in dev/test
// without FIREBASE_* env vars. First call to getMessaging() will throw a
// clear error if creds aren't configured (the QStash handler logs and lets
// the job retry — operator fixes the env, no code change needed).
// ─────────────────────────────────────────────────────────────────────────────

function getApp(): App {
  const [existing] = getApps();
  if (existing) return existing;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!projectId || !serviceAccountJson) {
    throw new Error(
      '[FCM] FIREBASE_PROJECT_ID and FIREBASE_SERVICE_ACCOUNT_KEY must be set to send push notifications'
    );
  }

  return initializeApp({
    credential: cert(JSON.parse(serviceAccountJson) as Record<string, string>),
    projectId,
  });
}

export function getMessaging(): Messaging {
  return getMessagingFromAdmin(getApp());
}
