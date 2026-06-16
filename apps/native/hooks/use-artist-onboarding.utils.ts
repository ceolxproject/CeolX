/** Max length of `artist_profiles.stage_name` — mirrors the shared validator. */
export const STAGE_NAME_MAX = 100;

/**
 * Initial value for the onboarding stage-name field: the account/registration
 * name, so registration → onboarding starts consistent. Capped at the
 * stage-name limit so the field never starts in an invalid state, and falls
 * back to empty when the account has no name (e.g. some social signups).
 */
export function initialStageName(name: string | null | undefined): string {
  return (name ?? '').slice(0, STAGE_NAME_MAX);
}
