/**
 * Canonical email normalization for the auth layer.
 *
 * Why this exists: the DB `user.email` unique constraint is byte-exact and
 * Better Auth stores/looks up the email exactly as it receives it. The native
 * sign-up/sign-in screens send the raw typed value, so casing differences
 * (autofill, paste, password managers, some Android keyboards) between sign-up
 * and login produced "verified but still asked to verify" / wrong-account
 * states (Asana 1215700058851867).
 *
 * Normalizing at the request layer (Better Auth `hooks.before`) makes signup,
 * verification, and login agree on one key.
 *
 * Note: we intentionally DO NOT strip the `+tag` sub-address. `a+artist@x.com`
 * and `a+venue@x.com` stay distinct accounts — a single inbox legitimately
 * backs both an Artist and a Venue account, since role switching is not
 * supported (MoM 3rd Apr 2026).
 */
export function normalizeEmail(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  return normalized || undefined;
}
