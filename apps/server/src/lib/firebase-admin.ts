import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging as getMessagingFromAdmin, type Messaging } from 'firebase-admin/messaging';

// ─────────────────────────────────────────────────────────────────────────────
// firebase-admin singleton — lazy init so the server boots in dev/test/CI
// without FIREBASE_* env vars (mentor pattern §3 — isFirebaseConfigured guard).
// First call to getMessaging() returns null when creds are missing or init
// has previously failed; the push handler treats null as a silent no-op so
// QStash jobs don't pile up retries against a misconfigured environment.
// ─────────────────────────────────────────────────────────────────────────────

let initFailed = false;

export function isFirebaseConfigured(): boolean {
  return Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
}

function getApp(): App | null {
  const [existing] = getApps();
  if (existing) return existing;

  if (initFailed) return null;

  // Narrow via runtime checks instead of non-null assertions — keeps eslint
  // happy and means isFirebaseConfigured() can stay a public boolean for
  // call-site short-circuiting without the init having to trust it.
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!projectId || !serviceAccountJson) return null;

  try {
    return initializeApp({
      credential: cert(JSON.parse(serviceAccountJson) as Record<string, string>),
      projectId,
    });
  } catch (err) {
    initFailed = true;
    console.error('[firebase] failed to initialize firebase-admin:', err);
    return null;
  }
}

export function getMessaging(): Messaging | null {
  const app = getApp();
  return app ? getMessagingFromAdmin(app) : null;
}
