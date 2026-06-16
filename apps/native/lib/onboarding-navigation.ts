/**
 * React Navigation's `beforeRemove` event fires for EVERY action that removes
 * the screen from the stack — not only user-initiated back gestures. The
 * onboarding screens only want to intervene (the Step 1 discard prompt, or the
 * Step 2/3 step-back) for genuine BACK navigation. Programmatic REPLACE / PUSH
 * driven by the auth + routing flow — e.g. the Google sign-up roundtrip
 * redirecting /(app)/(tabs)/map → /(auth)/venue-onboarding — must pass through
 * untouched, otherwise the "Discard onboarding?" dialog appears unbidden mid
 * sign-up (Asana 1215278068024772).
 */
export function isBackNavigationAction(actionType: string | undefined): boolean {
  return actionType === 'GO_BACK' || actionType === 'POP' || actionType === 'POP_TO_TOP';
}
