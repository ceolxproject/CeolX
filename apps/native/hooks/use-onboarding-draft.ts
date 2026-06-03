import { useEffect, useRef, useState } from 'react';

import {
  clearOnboardingDraft,
  loadOnboardingDraft,
  saveOnboardingDraft,
  type OnboardingRole,
} from '@/lib/storage/onboarding-draft';

// Coalesce keystrokes into a single write a short moment after typing stops.
const SAVE_DEBOUNCE_MS = 400;

interface UseOnboardingDraftOpts<T> {
  role: OnboardingRole;
  userId: string | undefined;
  /** Current in-memory draft. Must be JSON-serialisable. */
  draft: T;
  /** Applies a restored draft back into the form's state. */
  onHydrate: (draft: T) => void;
}

interface UseOnboardingDraftReturn {
  /** True once the initial load has resolved (whether or not a draft existed). */
  hydrated: boolean;
  /** Delete the persisted draft — call on successful submit or explicit discard. */
  clearDraft: () => void;
}

/**
 * Persists a multi-step onboarding draft to SecureStore so it survives the app
 * being backgrounded and killed by the OS, then silently restores it on the
 * next mount. Writes are gated on hydration completing so the blank initial
 * state can never overwrite a real saved draft.
 */
export function useOnboardingDraft<T>({
  role,
  userId,
  draft,
  onHydrate,
}: UseOnboardingDraftOpts<T>): UseOnboardingDraftReturn {
  const [hydrated, setHydrated] = useState(false);

  // Hold the latest callback / draft in refs so the effects below can depend on
  // stable inputs (role, userId, serialised draft) without re-subscribing on
  // every render or pulling a stale closure.
  const onHydrateRef = useRef(onHydrate);
  onHydrateRef.current = onHydrate;
  const draftRef = useRef(draft);
  draftRef.current = draft;

  // Load once per user. Until this resolves we must not write, or the empty
  // pre-hydration state would clobber the saved draft.
  useEffect(() => {
    let cancelled = false;
    setHydrated(false);
    void loadOnboardingDraft<T>(role, userId ?? '').then((saved) => {
      if (cancelled) return;
      if (saved) onHydrateRef.current(saved);
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [role, userId]);

  // Persist on change, debounced, and only after hydration. Depending on the
  // serialised draft (not the object identity) means we write only on real
  // value changes, while draftRef gives the timer the freshest snapshot.
  const serialized = JSON.stringify(draft);
  useEffect(() => {
    if (!hydrated || !userId) return;
    const timer = setTimeout(() => {
      void saveOnboardingDraft(role, userId, draftRef.current);
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [hydrated, role, userId, serialized]);

  const clearDraft = () => {
    if (userId) void clearOnboardingDraft(role, userId);
  };

  return { hydrated, clearDraft };
}
