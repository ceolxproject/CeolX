import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';

import {
  artistOnboardingStep1Schema,
  artistOnboardingStep2Schema,
  artistOnboardingStep3Schema,
  createArtistOnboardingSchema,
} from '@CeolX/shared/validators';

import { appToast } from '@/components/AppToast';
import type { SocialLinks } from '@/components/onboarding/SocialLinksSection';
import { useAuth } from '@/contexts/auth-context';
import { initialStageName } from '@/hooks/use-artist-onboarding.utils';
import { useMediaUpload } from '@/hooks/use-media-upload';
import { useOnboardingDraft } from '@/hooks/use-onboarding-draft';
import { computeStepErrors } from '@/lib/onboarding-validation';
import { pickSquarePhoto, requestPhotoLibraryPermission } from '@/utils/image-picker';
import { normalizeOptionalUrl } from '@/utils/normalize-url';
import { trpc, type RouterOutputs } from '@/utils/trpc';
import { getTRPCErrorCode, getTRPCErrorMessage } from '@/utils/trpc-error';

type Step = 1 | 2 | 3;

// The slice of onboarding state worth surviving an app kill. Validation/UI
// state (errors, touched, submitError) is intentionally excluded — it is
// re-derived from the restored values on the next interaction.
interface ArtistOnboardingDraft {
  stageName: string;
  bio: string;
  contactEmail: string;
  socialLinks: SocialLinks;
  profileImageUri: string | null;
  currentStep: Step;
}

// Field paths driving the per-step touched-set policy. On Next-press, every
// field for the current step is marked touched so validation errors render
// at the right time; the same map clears only the current step's errors when
// validation passes.
const FIELDS_BY_STEP: Record<Step, readonly string[]> = {
  1: ['stageName', 'contactEmail'],
  2: ['bio'],
  3: ['socialLinks.INSTAGRAM', 'socialLinks.FACEBOOK', 'socialLinks.TIKTOK', 'socialLinks.YOUTUBE'],
};

export function useArtistOnboarding() {
  const { user } = useAuth();

  // Pre-fill from the registration name so registration → onboarding → profile
  // start consistent; the artist can still override it (band name).
  const [stageName, setStageName] = useState(() => initialStageName(user?.name));
  const [bio, setBio] = useState('');
  const [contactEmail, setContactEmail] = useState(user?.email ?? '');
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({
    INSTAGRAM: '',
    FACEBOOK: '',
    TIKTOK: '',
    YOUTUBE: '',
  });
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const { mutateAsync: createArtistProfile, isPending } = useMutation(
    trpc.onboarding.createArtistProfile.mutationOptions()
  );
  const { uploadMedia, isUploading: isImageUploading } = useMediaUpload('profile_image');

  // ── Draft persistence (survives app kill / background) ───────────────────

  const { clearDraft } = useOnboardingDraft<ArtistOnboardingDraft>({
    role: 'artist',
    userId: user?.id,
    draft: { stageName, bio, contactEmail, socialLinks, profileImageUri, currentStep },
    onHydrate: (saved) => {
      setStageName(saved.stageName ?? '');
      setBio(saved.bio ?? '');
      if (saved.contactEmail) setContactEmail(saved.contactEmail);
      setSocialLinks({
        INSTAGRAM: '',
        FACEBOOK: '',
        TIKTOK: '',
        YOUTUBE: '',
        ...(saved.socialLinks as Partial<SocialLinks>),
      });
      setProfileImageUri(saved.profileImageUri ?? null);
      if (saved.currentStep) setCurrentStep(saved.currentStep);
    },
  });

  // ── Step navigation ─────────────────────────────────────────────────────

  // Normalize bare domains (e.g. `instagram.com/me`) to `https://…` before
  // validating, so users aren't forced to type the scheme. Empty fields become
  // undefined (omitted). Mirrors the edit-profile screen's submit boundary.
  const normalizedSocialLinks = () => ({
    INSTAGRAM: normalizeOptionalUrl(socialLinks.INSTAGRAM),
    FACEBOOK: normalizeOptionalUrl(socialLinks.FACEBOOK),
    TIKTOK: normalizeOptionalUrl(socialLinks.TIKTOK),
    YOUTUBE: normalizeOptionalUrl(socialLinks.YOUTUBE),
  });

  // `overrides` carry not-yet-committed values (a field that just changed but
  // whose setState hasn't flushed) and win over the state-derived base, so
  // change-handler validation sees the new value rather than the stale one.
  const buildStepValues = (step: Step, overrides: Record<string, unknown> = {}) => {
    if (step === 1) return { stageName, contactEmail: contactEmail || undefined, ...overrides };
    if (step === 2) return { bio: bio || undefined, ...overrides };
    return { socialLinks: normalizedSocialLinks(), ...overrides };
  };

  // Pass an explicit `currentTouched` Set when the caller has just computed a
  // new value; React batches setState so reading `touched` after setTouched in
  // the same handler would return the stale snapshot.
  const validateStep = (
    step: Step,
    currentTouched: Set<string> = touched,
    overrides: Record<string, unknown> = {}
  ): boolean => {
    const schema =
      step === 1
        ? artistOnboardingStep1Schema
        : step === 2
          ? artistOnboardingStep2Schema
          : artistOnboardingStep3Schema;
    const result = schema.safeParse(buildStepValues(step, overrides));

    setErrors((prev) =>
      computeStepErrors({
        result,
        stepFields: FIELDS_BY_STEP[step],
        touched: currentTouched,
        prevErrors: prev,
      })
    );

    return result.success;
  };

  const markStepTouched = (step: Step): Set<string> => {
    const next = new Set(touched);
    for (const f of FIELDS_BY_STEP[step]) next.add(f);
    setTouched(next);
    return next;
  };

  const handleBlur = (field: string) => {
    const next = touched.has(field) ? touched : new Set(touched).add(field);
    if (next !== touched) setTouched(next);
    validateStep(currentStep, next);
  };

  const goNext = async () => {
    const newTouched = markStepTouched(currentStep);

    if (currentStep === 3) {
      if (!validateStep(3, newTouched)) return;
      await handleSubmit();
      return;
    }

    if (validateStep(currentStep, newTouched)) {
      setCurrentStep((s) => (s + 1) as Step);
    }
  };

  const goBack = () => {
    if (currentStep === 1) return;
    setCurrentStep((s) => (s - 1) as Step);
  };

  const goToStep = (step: Step) => {
    if (step < currentStep) setCurrentStep(step);
  };

  // ── Existing handlers ───────────────────────────────────────────────────

  const handlePickImage = async () => {
    setImageError(null);
    try {
      const permission = await requestPhotoLibraryPermission();
      if (!permission.granted) {
        setImageError(
          permission.canAskAgain
            ? 'Photo library access is required to upload a profile picture.'
            : 'Photo access is disabled. Enable it in Settings > CeolX.'
        );
        return;
      }
      const uri = await pickSquarePhoto();
      if (uri) setProfileImageUri(uri);
    } catch {
      setImageError("Couldn't open the photo library. Please try again.");
    }
  };

  const handleRemoveImage = () => {
    setProfileImageUri(null);
    setImageError(null);
  };

  // Once a field has been touched (e.g. a failed Next surfaced its error),
  // re-validate it on every change so the error clears the instant the value
  // becomes valid — not only on the next blur or Next-press. The new value is
  // passed through to validateStep because setState is batched.
  const handleStageNameChange = (value: string) => {
    setStageName(value);
    if (touched.has('stageName')) validateStep(1, touched, { stageName: value });
  };

  const handleBioChange = (value: string) => {
    setBio(value);
    if (touched.has('bio')) validateStep(2, touched, { bio: value || undefined });
  };

  const handleSocialLinkChange = (field: keyof SocialLinks, value: string) => {
    const nextLinks = { ...socialLinks, [field]: value };
    setSocialLinks(nextLinks);
    if (touched.has(`socialLinks.${field}`)) {
      validateStep(3, touched, {
        socialLinks: {
          INSTAGRAM: nextLinks.INSTAGRAM || undefined,
          FACEBOOK: nextLinks.FACEBOOK || undefined,
          TIKTOK: nextLinks.TIKTOK || undefined,
          YOUTUBE: nextLinks.YOUTUBE || undefined,
        },
      });
    }
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    setErrors({});

    let profileImageUrl: string | undefined;
    if (profileImageUri) {
      try {
        const { cdnUrl } = await uploadMedia({ uri: profileImageUri });
        profileImageUrl = cdnUrl;
      } catch (err) {
        setImageError(err instanceof Error ? err.message : 'Image upload failed');
        // The error is rendered next to ProfilePicture on Step 1. If the user
        // pressed Submit on Step 3 we'd otherwise leave them staring at an
        // unresponsive button — walk them back to where the error is visible.
        if (currentStep !== 1) setCurrentStep(1);
        return;
      }
    }

    const parsed = createArtistOnboardingSchema.safeParse({
      stageName,
      bio: bio || undefined,
      contactEmail: contactEmail || undefined,
      socialLinks: normalizedSocialLinks(),
      profileImageUrl,
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        fieldErrors[issue.path.join('.')] = issue.message;
      }
      setErrors(fieldErrors);
      // Walk the user back to the earliest step that has an unresolved error.
      const stepWithError = ([1, 2, 3] as const).find((s) =>
        FIELDS_BY_STEP[s].some((f) => fieldErrors[f])
      );
      if (stepWithError && stepWithError !== currentStep) setCurrentStep(stepWithError);
      return;
    }

    try {
      await createArtistProfile(parsed.data);
      // Onboarding succeeded — the draft has served its purpose and must not
      // resurrect on a future sign-up for this account.
      clearDraft();
      // Optimistically flip onboardingComplete so (app)/_layout's redirect
      // guard doesn't bounce us back on the next mount. invalidate runs in
      // the background to reconcile the rest of the me payload.
      queryClient.setQueryData<RouterOutputs['users']['me']>(trpc.users.me.queryKey(), (old) =>
        old ? { ...old, onboardingComplete: true } : old
      );
      void queryClient.invalidateQueries({ queryKey: trpc.users.me.queryKey() });
      appToast.success('Artist profile created', 'Welcome to CeolX!');
      router.replace('/(app)/(tabs)/map');
    } catch (err: unknown) {
      // If the server says the profile already exists, the user has finished
      // onboarding (possibly from a half-failed prior submit). Route them
      // forward instead of dead-ending on the form.
      if (getTRPCErrorCode(err) === 'CONFLICT') {
        clearDraft();
        queryClient.setQueryData<RouterOutputs['users']['me']>(trpc.users.me.queryKey(), (old) =>
          old ? { ...old, onboardingComplete: true } : old
        );
        void queryClient.invalidateQueries({ queryKey: trpc.users.me.queryKey() });
        router.replace('/(app)/(tabs)/map');
        return;
      }
      setSubmitError(
        getTRPCErrorMessage(err, {
          FORBIDDEN: "Your account isn't set up as an artist. Please contact support.",
        })
      );
    }
  };

  return {
    // fields
    stageName,
    setStageName: handleStageNameChange,
    bio,
    setBio: handleBioChange,
    contactEmail,
    setContactEmail,
    socialLinks,
    handleSocialLinkChange,
    profileImageUri,
    imageError,
    // state
    errors,
    submitError,
    isPending: isPending || isImageUploading,
    // handlers
    handlePickImage,
    handleRemoveImage,
    handleSubmit,
    // draft persistence
    clearDraft,
    // step navigation
    currentStep,
    touched,
    goNext,
    goBack,
    goToStep,
    handleBlur,
  };
}
