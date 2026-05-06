# Multi-Step Onboarding Refactor — Design Spec

**Date**: 2026-05-06
**Asana**: [Improve Onboarding Flow & Navigation Consistency (Artist/Venue + Spectator)](https://app.asana.com/1/1194107417268910/project/1210959953917909/task/1214534018893390)
**Author**: Priya Yadav (with Claude)
**Status**: Draft, awaiting user review

---

## 1. Scope

This spec covers **only the onboarding refactor** portion of the Asana task. The other two sub-features (terminology rename of "Booking" → "My Events / Requests / Collaborations", and bottom-nav polish) are deferred to follow-up tickets:

- **Terminology rename** — deferred until Pratiksha (PM) confirms the mapping, especially the "Collaborations" label which collides with the M5/M6 collaborator concept on event forms (per memory `project_event_form_business_rules.md`).
- **Bottom-nav polish** — already 80% done. `apps/native/components/AppTabBar.tsx` renders the same 4 tabs (Map, Discover, Bookings/Requests, Profile) for all roles, with role-aware label flip and conditional FAB. Remaining work is small and scheduled as a follow-up.

### In scope

Refactor the existing single-screen Artist and Venue onboarding flows into 3-step wizards with:

- A numbered, tappable step indicator at the top.
- Per-step Zod validation against schemas exported from `@CeolX/shared/validators`.
- Form state preserved when navigating between steps via the indicator or Back button.
- Hybrid validation: errors surface on field blur after touch; press of Next gates progression.
- Discard-onboarding confirm dialog when user gestures back on Step 1.

### Out of scope (recorded so it does not creep in)

- New profile fields (`category`, `genres`, `services`) — separate ticket needed; requires Pratiksha input on enums.
- Terminology rename ("Booking" → "My Events / Requests / Collaborations").
- Bottom-nav polish.
- The 5 critical bugs identified in PR #28 (`verify-email.tsx` corrupted role assignment, silent `SecureStore` failures, `JSON.parse` no-catch, missing DB transaction in `onboarding.ts`, `profileImageUrl` discarded in router) — flagged in memory `project_pr28_artist_onboarding.md`. These are separate fixes and must not be co-mingled.
- Persisting onboarding state across app kill. State persists across step navigation and across app **backgrounding** (in-memory React state survives that), but not across full app process termination — a one-shot first-launch flow does not warrant a SecureStore/AsyncStorage layer.
- Server-side `onboarding.ts` router contract — unchanged. The merged step schemas are byte-for-byte equivalent to the current `createArtistOnboardingSchema` / `createVenueOnboardingSchema`.

---

## 2. Decisions Made (with rationale)

| #   | Decision                                                                       | Rationale                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Single Expo Router screen with internal `currentStep` state                    | Onboarding is a one-shot flow; per-route URLs (multi-screen Stack) provide no value. Existing `useArtistOnboarding` / `useVenueOnboarding` hooks are already the right state boundary.                 |
| 2   | Adapt to existing fields only — no new profile columns                         | Title is "Improve Onboarding Flow", not data-model expansion. `category`/`genres`/`services` are Asana suggestions but require product input; defer to a separate ticket.                              |
| 3   | Hybrid per-step validation (live on blur, full check on Next)                  | Industry standard (Stripe, Robinhood, Cash App). Avoids the "click → error → fix → click again" loop without the disabled-button mystery.                                                              |
| 4   | Numbered tappable stepper for past steps (forward jumps blocked)               | Asana acceptance criterion explicitly says "navigate back and forth without losing data" — tappable past steps fits that wording better than a slim progress bar.                                      |
| 5   | Hardware/swipe back on Step 1 → discard confirm; on Step 2/3 → step back       | Protects against accidental data loss on iOS edge-swipe. One `Alert.alert` is the standard mobile pattern.                                                                                             |
| 6   | Image upload still happens at final submit (Step 3), not on pick               | Avoids orphan S3 uploads if the user abandons mid-flow. Keeps existing `useMediaUpload` integration intact.                                                                                            |
| 7   | Step components live under `apps/native/components/onboarding/{artist,venue}/` | Component reuse not anticipated, but the colocation under `components/onboarding/` matches the pattern already established by `ProfilePicture.tsx`, `SocialLinksSection.tsx`, `VenueLinksSection.tsx`. |

### Pending Decision (must resolve before implementation)

**D1. Should bio be required to advance from Step 2?**

The current `createArtistOnboardingSchema` and `createVenueOnboardingSchema` (in `packages/shared/src/validators/profiles.ts:36,48`) both have `bio` as **optional** (`z.string().max(50).trim().optional()`). If we keep bio optional, Artist Step 2 becomes a no-op for users who don't want to write one — they can press Next on empty input and the step feels pointless.

- **Option D1.A — Keep bio optional.** Step 2 is "fast-skip" friendly. Per-step schema for Step 2 (Artist) accepts empty input. Step 2 (Venue) still has `address` as required, so it's not pass-through there.
- **Option D1.B — Tighten bio to required (≥1 char) as part of this PR.** Step 2 has meaning for both personas. Schema change: `bio: z.string().min(1).max(50).trim()`. Server contract gets stricter — but only forward, since this is an input validator and existing rows are unaffected.

This is a UX/product call, not a technical one. **Default if unresolved**: D1.A (keep optional, don't change server contract in a UX-refactor PR). The per-step schemas in §6 below currently reflect D1.A.

---

## 3. File Changes

### Files added

```
apps/native/components/onboarding/
  shared/
    StepIndicator.tsx               -- 1-2-3 tappable indicator
    StepNavButtons.tsx              -- Back + primary footer
    OnboardingHeader.tsx            -- extracted from existing screens
  artist/
    Step1BasicInfo.tsx              -- profile pic, stage name, contact email
    Step2ProfileDetails.tsx         -- bio
    Step3SocialMedia.tsx            -- 4 social links
  venue/
    Step1BasicInfo.tsx              -- profile pic / logo, venue name, contact email
    Step2ProfileDetails.tsx         -- bio, address
    Step3SocialMedia.tsx            -- 4 venue links

apps/native/hooks/
  use-discard-onboarding-back-handler.ts
```

### Files changed

```
apps/native/app/(auth)/artist-onboarding.tsx       -- thin shell (header + indicator + step + nav)
apps/native/app/(auth)/venue-onboarding.tsx        -- same shell pattern
apps/native/hooks/use-artist-onboarding.ts         -- adds currentStep, goNext, goBack, goToStep, touched, handleBlur
apps/native/hooks/use-venue-onboarding.ts          -- same additions
packages/shared/src/validators/profiles.ts         -- export per-step schemas; existing flat schema becomes a merge
packages/shared/src/validators/__tests__/validators.test.ts  -- step + equivalence tests
```

### Files NOT touched

- `packages/api/src/routers/onboarding.ts` (server contract unchanged)
- `packages/db/src/schema/users.ts`, `artist_profiles`, `venue_profiles` (no schema changes)
- `(auth)/verify-email.tsx`, `(auth)/sign-up.tsx`, `contexts/auth-context.tsx`, `(app)/_layout.tsx` (PR #28 bugs are out of scope)

---

## 4. Step Contents

> Required-to-advance reflects **Decision D1.A** (default: keep bio optional). If D1.B is chosen during user spec review, update Bio rows in both tables to "(≥1 char, ≤50, required)".

### Artist onboarding

| Step | Title                    | Fields                                     | Required to advance (matches existing schema)                                                                                                                                                                       |
| ---- | ------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | "Tell us about yourself" | Profile picture, Stage name, Contact email | Stage name (≥1 char, ≤100, trim). Contact email defaults from auth user; if changed, must parse as email. Profile pic optional (note: see §11 Risk — `profileImageUrl` is currently dropped at validator boundary). |
| 2    | "Your story"             | Bio                                        | Bio (≤50 chars, optional). Step 2 advances even on empty bio.                                                                                                                                                       |
| 3    | "Connect your socials"   | Instagram, Facebook, TikTok, YouTube       | All optional. Filled rows must parse as URL or be empty (existing `socialUrl` schema).                                                                                                                              |

### Venue onboarding

| Step | Title                  | Fields                                            | Required to advance (matches existing schema)                                                            |
| ---- | ---------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1    | "About your venue"     | Profile picture / logo, Venue name, Contact email | Venue name (≥1 char, ≤255, trim). Contact email valid if changed. Logo optional (same caveat as Artist). |
| 2    | "Where & why"          | Bio, Venue location                               | Address required (≥1 char, ≤255, trim). Bio (≤50 chars) optional.                                        |
| 3    | "Connect your socials" | Website, Instagram, Facebook, Twitter             | All optional. Filled rows must parse as URL or be empty.                                                 |

### Final-step copy

- Steps 1, 2: primary button reads "Next".
- Step 3: primary button reads "Create Artist Profile" / "Create Venue Profile" (matches existing copy).
- Back button: hidden on Step 1; on Step 2/3 reads "Back".

---

## 5. Step Indicator Component

```
[ 1 ]──────[ 2 ]──────[ 3 ]
 done       active    upcoming
```

### Visual states

- **Done**: filled `#C8FF2F` circle, white check icon, tappable. Connector ahead is `#C8FF2F`.
- **Active**: filled `#6155F5` circle, white step number. Connector ahead is `bg-white/20`.
- **Upcoming**: outline `border-white/30` circle, muted step number `text-white/40`. Not tappable. Connector matches.

### Contract

```ts
type StepIndicatorProps = {
  currentStep: 1 | 2 | 3;
  stepCount: 3;
  onStepPress: (step: 1 | 2 | 3) => void; // hook ignores presses on current/upcoming
};
```

Layout: `height: 56`, `px-5`, between `OnboardingHeader` and `ScrollView`. Tailwind classes only — no `StyleSheet.create` (per memory `feedback_no_stylesheet_create.md`).

### Accessibility

- `accessibilityRole="button"` on each circle.
- `accessibilityLabel`: e.g. `"Step 2 of 3, current"`, `"Step 1 of 3, completed, tap to go back"`.
- Upcoming steps carry `accessibilityState={{ disabled: true }}`.

---

## 6. Per-Step Validation

### New exports in `packages/shared/src/validators/profiles.ts`

The per-step schemas must compose into the **exact same shape** as the existing `createArtistOnboardingSchema` / `createVenueOnboardingSchema`. The existing schemas (lines 33-52 of `profiles.ts`) are the source of truth for required-ness and constraints — per-step splits inherit them verbatim. **Field constraints are copied directly from the existing schemas**, including the `.min(1).max(N).trim()` ordering (which has a known edge case where pure-whitespace input passes `.min(1)` before being trimmed; preserved for equivalence — fixing it is out of scope for this PR).

```ts
// Artist
export const artistOnboardingStep1Schema = z.object({
  stageName: z.string().min(1, 'Stage name is required').max(100).trim(),
  contactEmail: z.string().email('Invalid email address').optional(),
  // profileImageUrl deliberately omitted — existing schema doesn't declare it (M10 deferral
  // per profiles.ts:51). This is a known issue (PR #28 finding #5) but out of scope here.
});

export const artistOnboardingStep2Schema = z.object({
  bio: z.string().max(50, 'Bio must be 50 characters or less').trim().optional(),
});

export const artistOnboardingStep3Schema = z.object({
  socialLinks: socialLinksSchema.optional(),
});

export const createArtistOnboardingSchema = artistOnboardingStep1Schema
  .merge(artistOnboardingStep2Schema)
  .merge(artistOnboardingStep3Schema);

// Venue
export const venueOnboardingStep1Schema = z.object({
  venueName: z.string().min(1, 'Venue name is required').max(255).trim(),
  contactEmail: z.string().email('Invalid email address').optional(),
});

export const venueOnboardingStep2Schema = z.object({
  address: z.string().min(1, 'Venue location is required').max(255).trim(),
  bio: z.string().max(50, 'Description must be 50 characters or less').trim().optional(),
});

export const venueOnboardingStep3Schema = z.object({
  venueLinks: venueLinksSchema.optional(),
});

export const createVenueOnboardingSchema = venueOnboardingStep1Schema
  .merge(venueOnboardingStep2Schema)
  .merge(venueOnboardingStep3Schema);
```

If Decision **D1.B** is chosen (bio required), update the Step 2 schemas to `bio: z.string().min(1).max(50).trim()` for both personas — and update the equivalence tests in §10 to assert the new contract.

### Equivalence guarantee

The merged schema must accept and produce identical output to the previous flat `createArtistOnboardingSchema` for the server contract to remain unchanged. This is asserted in `validators.test.ts` with at least 3 representative payloads per persona (full, minimal, with image).

### Hook integration

```ts
const validateStep = (step: 1 | 2 | 3): boolean => {
  const schema =
    step === 1
      ? artistOnboardingStep1Schema
      : step === 2
        ? artistOnboardingStep2Schema
        : artistOnboardingStep3Schema;
  const result = schema.safeParse(currentValues);
  if (!result.success) {
    setErrors(mapZodIssues(result.error.issues));
    return false;
  }
  return true;
};
```

### Hybrid timing

- **On change**: only update field state.
- **On blur**: mark `touched[field] = true` and re-run `validateStep(currentStep)`.
- **On Next press**: full step validation; surface errors and stay on the step if invalid.
- **Render guard**: an error is only rendered if `touched.has(field) === true` OR the user has pressed Next at least once on this step.

### Edge cases

1. User edits Step 1 after returning from Step 2 → Next re-validates Step 1 from scratch.
2. User clears Step 2 bio → returns to Step 1 → cannot tap Step 3 indicator (forward jump blocked); must walk through Step 2 with Next.
3. Empty social links are stripped to `undefined` before parse (preserves existing behavior in `useArtistOnboarding.ts:84-88`).

---

## 7. Hook Additions

### `useArtistOnboarding` (Venue is symmetric)

```ts
const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
const [touched, setTouched] = useState<Set<string>>(new Set());

const markTouched = (field: string) =>
  setTouched((prev) => (prev.has(field) ? prev : new Set(prev).add(field)));

const validateStep = (step: 1 | 2 | 3): boolean => {
  /* see §6 */
};

const goNext = () => {
  if (currentStep === 3) return handleSubmit(); // Step 3 Next === Submit
  if (validateStep(currentStep)) {
    setErrors({});
    setCurrentStep((s) => (s + 1) as 1 | 2 | 3);
  }
};

const goBack = () => {
  if (currentStep === 1) return; // discard handler covers this
  setErrors({});
  setCurrentStep((s) => (s - 1) as 1 | 2 | 3);
};

const goToStep = (step: 1 | 2 | 3) => {
  if (step < currentStep) {
    setErrors({});
    setCurrentStep(step);
  }
};

const handleBlur = (field: string) => {
  markTouched(field);
  validateStep(currentStep);
};
```

Existing returns unchanged. Six new keys added: `currentStep`, `goNext`, `goBack`, `goToStep`, `touched`, `handleBlur`.

---

## 8. Screen Shell

```tsx
export default function ArtistOnboardingScreen() {
  const onboarding = useArtistOnboarding();
  const { currentStep, goBack, goToStep } = onboarding;

  const handleLogoutAndExit = async () => {
    await logout();
    router.replace('/(auth)/sign-in');
  };

  useDiscardOnboardingBackHandler({
    enabled: currentStep === 1,
    onConfirmDiscard: handleLogoutAndExit,
  });

  // Hardware back from Step 2/3 → step back, no alert
  useEffect(() => {
    if (currentStep === 1) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => sub.remove();
  }, [currentStep, goBack]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: '#080808' }}
    >
      <SafeAreaView className="flex-1">
        <OnboardingHeader onLogoutPress={handleLogoutAndExit} />
        <StepIndicator currentStep={currentStep} stepCount={3} onStepPress={goToStep} />
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, paddingTop: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          {currentStep === 1 && <Step1BasicInfo {...onboarding} />}
          {currentStep === 2 && <Step2ProfileDetails {...onboarding} />}
          {currentStep === 3 && <Step3SocialMedia {...onboarding} />}
        </ScrollView>
        <StepNavButtons
          showBack={currentStep > 1}
          primaryLabel={currentStep === 3 ? 'Create Artist Profile' : 'Next'}
          isPending={onboarding.isPending}
          onBack={goBack}
          onPrimary={onboarding.goNext}
        />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
```

Conditional render (not always-mounted) — keeps memory identical to today and avoids Android focus-stealing on hidden TextInputs.

---

## 9. Discard-onboarding Back Handler

```ts
// apps/native/hooks/use-discard-onboarding-back-handler.ts
export function useDiscardOnboardingBackHandler(opts: {
  enabled: boolean;
  onConfirmDiscard: () => void;
}) {
  // Android hardware back
  useEffect(() => {
    if (!opts.enabled) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      showDiscardAlert(opts.onConfirmDiscard);
      return true;
    });
    return () => sub.remove();
  }, [opts.enabled, opts.onConfirmDiscard]);

  // iOS swipe-back via Expo Router beforeRemove
  const navigation = useNavigation();
  useEffect(() => {
    if (!opts.enabled) return;
    const unsub = navigation.addListener('beforeRemove', (e) => {
      e.preventDefault();
      showDiscardAlert(() => {
        opts.onConfirmDiscard();
        navigation.dispatch(e.data.action);
      });
    });
    return unsub;
  }, [opts.enabled, opts.onConfirmDiscard, navigation]);
}

function showDiscardAlert(onConfirm: () => void) {
  Alert.alert(
    'Discard onboarding?',
    'Your progress will be lost. You can finish setting up your profile later.',
    [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onConfirm },
    ]
  );
}
```

Step 2/3 hardware back is handled by the screen-level `useEffect` (see §8) — separate from this hook so the discard alert and the step-back handler do not overlap.

---

## 10. Tests

### Validator tests (`packages/shared/src/validators/__tests__/validators.test.ts`)

- `artistOnboardingStep1Schema`:
  - Pass: valid stage name + email; valid stage name only (email omitted).
  - Fail: empty stage name; malformed email; stage name >100 chars (note: existing schema is `.max(100)`, not 50).
- `artistOnboardingStep2Schema` (assuming Decision **D1.A**):
  - Pass: bio at exactly 50 chars; bio omitted entirely; bio with surrounding whitespace (trimmed).
  - Fail: bio at 51 chars.
  - (If **D1.B**: also Fail on empty/omitted bio.)
- `artistOnboardingStep3Schema`:
  - Pass: socials omitted; all four empty strings (the existing `socialUrl` accepts `''`); one filled; all four filled.
  - Fail: malformed URL in any non-empty field.
- `venueOnboardingStep1Schema`: parallel to artist Step 1 with `venueName.max(255)`.
- `venueOnboardingStep2Schema`: address required (≥1, ≤255, trim); bio optional ≤50 (or required if D1.B).
- `venueOnboardingStep3Schema`: parallel to artist Step 3.
- **Equivalence**: `Step1.merge(Step2).merge(Step3).safeParse(payload)` produces the same `success` and `data` as `createArtistOnboardingSchema.safeParse(payload)` for at least 3 payloads (full, minimal, with-image-key-that-gets-stripped). Same three for Venue.

### Hook tests (conditional)

- New file `apps/native/hooks/__tests__/use-artist-onboarding.test.ts` — only if `@testing-library/react-native` is present in `apps/native/package.json`.
- If absent, hook tests become a follow-up ticket and are NOT a merge blocker for this PR.

### Manual test plan (in PR description)

- Artist + Venue full happy path with image.
- Per-step Next on empty step → errors render.
- Tap Step 1 indicator from Step 3 → fields preserved.
- iOS edge-swipe / Android hardware back on Step 1 → discard alert; Cancel keeps state; Discard logs out.
- Hardware back on Step 2 → returns to Step 1, no alert.
- Background app on Step 2 → return → state preserved.
- Image-upload error on Step 3 → image error renders, user not advanced; Next can be retried.

---

## 11. Risk & Mitigation

| Risk                                                                            | Likelihood                      | Mitigation                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Merged Zod schemas behave differently from flat schema                          | Medium                          | Equivalence assertion in validator tests with 3 payloads per persona before merge.                                                                                                                                                                                       |
| Hardware back handler leaks listeners on unmount                                | Low                             | `useEffect` cleanup returns `sub.remove()`; verified on simulator.                                                                                                                                                                                                       |
| `KeyboardAvoidingView` regresses existing scroll behavior on Android            | Low                             | `behavior` is `undefined` on Android (default); only iOS gets `'padding'`.                                                                                                                                                                                               |
| Tappable indicator confuses users into expecting forward jumps                  | Low                             | Forward steps render with `accessibilityState={{ disabled: true }}` and visually muted styling; presses on them are a no-op.                                                                                                                                             |
| Image picked on Step 1 then user abandons before Step 3 → no upload happens     | None (by design)                | Upload remains at Step 3; nothing in S3 to orphan.                                                                                                                                                                                                                       |
| `profileImageUrl` is silently dropped at validator boundary (PR #28 finding #5) | Carried over from existing code | NOT fixed in this PR. Step 1 still shows the picker UI for parity with current behavior; the upload still happens on Step 3 submit; the cdnUrl is still stripped by Zod before the tRPC call. Filing as a separate ticket. The user-visible state is identical to today. |

---

## 12. Effort Estimate

| Work item                                               | Estimate                     |
| ------------------------------------------------------- | ---------------------------- |
| Per-step Zod schemas + equivalence tests                | 30 min                       |
| 6 step components (Artist + Venue × 3)                  | 90 min                       |
| Hook additions (both hooks)                             | 30 min                       |
| `StepIndicator` + `StepNavButtons` + `OnboardingHeader` | 60 min                       |
| Screen shells + discard handler + back handler          | 60 min                       |
| Manual QA on iOS + Android simulators                   | 30 min                       |
| **Total**                                               | **~5 hours of focused work** |

---

## 13. Acceptance Criteria (from Asana, mapped to this design)

| Criterion                                                           | Where it's satisfied                                                                     |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Onboarding split into clearly defined steps with smooth transitions | §3 (file changes), §4 (step contents), §8 (screen shell)                                 |
| Users can navigate back and forth without losing data               | §5 (tappable past indicator), §7 (`goToStep` preserves all hook state), §8 (Back button) |
| Bottom navigation UI consistent across roles                        | Deferred — see §1 scope; already 80% done in `AppTabBar.tsx`                             |
| "Booking" fully replaced with new terminology across the app        | Deferred — see §1 scope                                                                  |
| No broken flows or mismatched labels across screens                 | §10 manual test plan covers full happy path                                              |
