import {
  GoogleSignin,
  isCancelledResponse,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';

import { env } from '@CeolX/env/native';

// The Google **Web** OAuth client id. It is the audience baked into the idToken
// the native SDK returns on BOTH iOS and Android — which is why the server's
// accepted clientId list must include this same value. Absent in dev/Expo Go,
// where the native module isn't present at all; configure() then no-ops so the
// rest of the app still boots.
const webClientId = env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

// Surfaced when the native SDK isn't usable (env var missing, or running in an
// environment without the native module). toUserMessage() maps "not available"
// to a friendly copy line.
export class GoogleSignInUnavailableError extends Error {
  constructor() {
    super('Google Sign-In is not available on this device.');
    this.name = 'GoogleSignInUnavailableError';
  }
}

// Surfaced when the user dismisses the native account sheet. toUserMessage()
// maps "cancelled" so the caller swallows it without an error alert.
export class GoogleSignInCancelledError extends Error {
  constructor() {
    super('Sign-in was cancelled.');
    this.name = 'GoogleSignInCancelledError';
  }
}

let configured = false;

// Initialise the native Google SDK exactly once. Safe to call from app startup
// AND lazily before the first sign-in — the guard makes repeat calls free. A
// no-op when webClientId is unset so a build without the env var still runs.
export function configureGoogleSignIn(): void {
  if (configured || !webClientId) return;
  GoogleSignin.configure({ webClientId, offlineAccess: false });
  configured = true;
}

// Clear the native Google SDK's cached account so the next sign-in always shows
// the account chooser instead of silently re-using the last account. The SDK
// keeps this cache independently of our BetterAuth session, so it must be torn
// down explicitly on app logout (and defensively before each sign-in). Best
// effort: a no signed-in account / unconfigured SDK is not an error worth
// surfacing — we just want the cache empty.
export async function signOutGoogle(): Promise<void> {
  if (!webClientId) return;
  configureGoogleSignIn();
  try {
    await GoogleSignin.signOut();
  } catch {
    // Already signed out, or SDK unavailable — nothing to clear.
  }
}

// Open the native account sheet and return a freshly-signed Google ID token
// (a JWT) for the chosen account. The token goes straight to BetterAuth via
// authClient.signIn.social({ provider: 'google', idToken: { token } }) — no
// browser, no callbackURL, no deep-link bounce.
export async function getGoogleIdToken(): Promise<string> {
  if (!webClientId) throw new GoogleSignInUnavailableError();
  configureGoogleSignIn();

  try {
    // Android-only check; resolves immediately on iOS. Prompts the user to
    // update Play Services if it's missing/outdated rather than failing opaquely.
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    // Clear any cached account first so a user who previously signed in with
    // Account A and signed out is offered the chooser — letting them pick a
    // different Account B — instead of the SDK silently reusing Account A.
    await signOutGoogle();

    const response = await GoogleSignin.signIn();

    if (isCancelledResponse(response)) throw new GoogleSignInCancelledError();
    if (!isSuccessResponse(response) || !response.data.idToken) {
      throw new Error('Google did not return an identity token.');
    }
    return response.data.idToken;
  } catch (error) {
    if (error instanceof GoogleSignInCancelledError) throw error;
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) throw new GoogleSignInCancelledError();
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new GoogleSignInUnavailableError();
      }
    }
    throw error;
  }
}
