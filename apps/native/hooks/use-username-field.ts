import { useCallback, useEffect, useRef, useState } from 'react';

import { usernameSchema } from '@CeolX/shared/validators';

import { authClient } from '@/lib/auth-client';

export type UsernameStatus = 'idle' | 'invalid' | 'checking' | 'available' | 'taken';

/**
 * Reusable logic for the one-time profile handle (ceolx.com/u/<username>),
 * shared by artist/venue onboarding and the set-on-first-share picker.
 *
 * - Input is forced lowercase (handles are lowercase-only), so a user typing
 *   "Priya" never trips the "lowercase only" error — it just becomes "priya".
 * - Format is validated synchronously against the shared usernameSchema.
 * - Availability is checked against BetterAuth's /is-username-available, debounced
 *   ~400ms. This is UX-only: the DB unique constraint + the updateUser call at
 *   submit are the real guards, so a failed/opaque availability call never blocks
 *   (status falls back to idle rather than a false "taken").
 */
export function useUsernameField() {
  const [value, setValueState] = useState('');
  const [status, setStatus] = useState<UsernameStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // Guards against out-of-order async results: only the latest check wins.
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const setValue = useCallback((raw: string) => {
    const handle = raw.toLowerCase();
    setValueState(handle);

    if (timer.current) clearTimeout(timer.current);
    const mySeq = ++seq.current;

    if (handle.length === 0) {
      setStatus('idle');
      setError(null);
      return;
    }

    const parsed = usernameSchema.safeParse(handle);
    if (!parsed.success) {
      setStatus('invalid');
      setError(parsed.error.issues[0]?.message ?? 'Invalid username');
      return;
    }

    setStatus('checking');
    setError(null);
    timer.current = setTimeout(async () => {
      try {
        const res = await authClient.isUsernameAvailable({ username: handle });
        if (mySeq !== seq.current) return; // a newer keystroke superseded this
        const available = res?.data?.available === true;
        setStatus(available ? 'available' : 'taken');
        setError(available ? null : 'That username is already taken');
      } catch {
        if (mySeq !== seq.current) return;
        // Couldn't verify — don't block. updateUser + the unique index catch it.
        setStatus('idle');
        setError(null);
      }
    }, 400);
  }, []);

  // Surfaces a "required" error when the user tries to advance with an empty
  // handle (otherwise an empty required field would block Next silently).
  const markTouched = useCallback(() => {
    if (value.trim().length === 0) {
      setStatus('invalid');
      setError('Username is required');
    }
  }, [value]);

  // Safe to submit when the format is valid and we haven't confirmed it's taken.
  // ('checking' is allowed through — updateUser is the final arbiter.)
  const canSubmit = value.length > 0 && status !== 'invalid' && status !== 'taken';

  return { value, setValue, status, error, canSubmit, markTouched };
}
