import * as SecureStore from 'expo-secure-store';

export type OnboardingRole = 'artist' | 'venue';

// SecureStore keys may only contain [A-Za-z0-9._-]. better-auth user ids fit
// that set today, but sanitising keeps us safe against any id format change.
export function onboardingDraftKey(role: OnboardingRole, userId: string): string {
  const safeUserId = userId.replace(/[^A-Za-z0-9._-]/g, '_');
  return `onboarding-draft-${role}-${safeUserId}`;
}

/**
 * Read the persisted onboarding draft for a user, or null when none exists or
 * the stored value is unusable. Never throws — a corrupt draft must not block
 * the user from onboarding.
 */
export async function loadOnboardingDraft<T>(
  role: OnboardingRole,
  userId: string
): Promise<T | null> {
  if (!userId) return null;
  const raw = await SecureStore.getItemAsync(onboardingDraftKey(role, userId));
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed !== null && typeof parsed === 'object' ? (parsed as T) : null;
  } catch {
    return null;
  }
}

/** Persist the onboarding draft. No-op without a user id. */
export async function saveOnboardingDraft<T>(
  role: OnboardingRole,
  userId: string,
  draft: T
): Promise<void> {
  if (!userId) return;
  await SecureStore.setItemAsync(onboardingDraftKey(role, userId), JSON.stringify(draft));
}

/** Remove the onboarding draft (after a successful submit or an explicit discard). */
export async function clearOnboardingDraft(role: OnboardingRole, userId: string): Promise<void> {
  if (!userId) return;
  await SecureStore.deleteItemAsync(onboardingDraftKey(role, userId));
}
