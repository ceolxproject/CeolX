import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';

import {
  createVenueOnboardingSchema,
  venueOnboardingStep1Schema,
  venueOnboardingStep2Schema,
  venueOnboardingStep3Schema,
} from '@CeolX/shared/validators';

import type { VenueLinks } from '@/components/onboarding/VenueLinksSection';
import { useAuth } from '@/contexts/auth-context';
import { useMediaUpload } from '@/hooks/use-media-upload';
import { useOnboardingDraft } from '@/hooks/use-onboarding-draft';
import { useUsernameField, type UsernameStatus } from '@/hooks/use-username-field';
import { AnalyticsEvent, track } from '@/lib/analytics';
import { authClient } from '@/lib/auth-client';
import { computeStepErrors } from '@/lib/onboarding-validation';
import { pickSquarePhoto, requestPhotoLibraryPermission } from '@/utils/image-picker';
import { normalizeOptionalUrl } from '@/utils/normalize-url';
import { trpc, type RouterOutputs } from '@/utils/trpc';
import { getTRPCErrorCode, getTRPCErrorMessage } from '@/utils/trpc-error';

type Step = 1 | 2 | 3;

// The slice of onboarding state worth surviving an app kill. Validation/UI
// state (errors, touched, submitError) is intentionally excluded — it is
// re-derived from the restored values on the next interaction.
interface VenueOnboardingDraft {
  venueName: string;
  username: string;
  bio: string;
  address: string;
  lat: number | null;
  lng: number | null;
  contactEmail: string;
  venueLinks: VenueLinks;
  profileImageUri: string | null;
  currentStep: Step;
}

const FIELDS_BY_STEP: Record<Step, readonly string[]> = {
  1: ['venueName', 'contactEmail'],
  2: ['address', 'lat', 'lng', 'bio'],
  3: ['venueLinks.WEBSITE', 'venueLinks.INSTAGRAM', 'venueLinks.FACEBOOK', 'venueLinks.TWITTER'],
};

interface UseVenueOnboardingReturn {
  venueName: string;
  setVenueName: (v: string) => void;
  username: string;
  setUsername: (v: string) => void;
  usernameStatus: UsernameStatus;
  usernameError: string | null;
  bio: string;
  setBio: (v: string) => void;
  address: string;
  lat: number | null;
  lng: number | null;
  /** Set venue location from the map pin (lat/lng mandatory; address derived). */
  setLocation: (loc: { lat: number; lng: number; address: string }) => void;
  contactEmail: string;
  setContactEmail: (v: string) => void;
  venueLinks: VenueLinks;
  handleVenueLinkChange: (field: keyof VenueLinks, value: string) => void;
  profileImageUri: string | null;
  imageError: string | null;
  errors: Record<string, string>;
  submitError: string | null;
  isPending: boolean;
  handlePickImage: () => Promise<void>;
  handleRemoveImage: () => void;
  handleSubmit: () => Promise<void>;
  clearDraft: () => void;
  currentStep: Step;
  touched: Set<string>;
  goNext: () => Promise<void>;
  goBack: () => void;
  goToStep: (step: Step) => void;
  handleBlur: (field: string) => void;
}

export function useVenueOnboarding(): UseVenueOnboardingReturn {
  const { user } = useAuth();

  const [venueName, setVenueName] = useState('');
  // Handle lives on the user row (BetterAuth username plugin), set via
  // authClient.updateUser at submit — kept out of the createVenueProfile contract.
  const username = useUsernameField();
  const [bio, setBio] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [contactEmail, setContactEmail] = useState(user?.email ?? '');
  const [venueLinks, setVenueLinks] = useState<VenueLinks>({
    WEBSITE: '',
    INSTAGRAM: '',
    FACEBOOK: '',
    TWITTER: '',
  });
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const { mutateAsync: createVenueProfile, isPending } = useMutation(
    trpc.onboarding.createVenueProfile.mutationOptions()
  );
  const { uploadMedia, isUploading: isImageUploading } = useMediaUpload('profile_image');

  // ── Draft persistence (survives app kill / background) ───────────────────

  const { clearDraft } = useOnboardingDraft<VenueOnboardingDraft>({
    role: 'venue',
    userId: user?.id,
    draft: {
      venueName,
      username: username.value,
      bio,
      address,
      lat,
      lng,
      contactEmail,
      venueLinks,
      profileImageUri,
      currentStep,
    },
    onHydrate: (saved) => {
      setVenueName(saved.venueName ?? '');
      if (saved.username) username.setValue(saved.username);
      setBio(saved.bio ?? '');
      setAddress(saved.address ?? '');
      setLat(saved.lat ?? null);
      setLng(saved.lng ?? null);
      if (saved.contactEmail) setContactEmail(saved.contactEmail);
      setVenueLinks({
        WEBSITE: '',
        INSTAGRAM: '',
        FACEBOOK: '',
        TWITTER: '',
        ...(saved.venueLinks as Partial<VenueLinks>),
      });
      setProfileImageUri(saved.profileImageUri ?? null);
      if (saved.currentStep) setCurrentStep(saved.currentStep);
    },
  });

  // ── Step navigation ─────────────────────────────────────────────────────

  // Normalize bare domains (e.g. `instagram.com/me`) to `https://…` before
  // validating, so users aren't forced to type the scheme. Empty fields become
  // undefined (omitted). Mirrors the edit-profile screen's submit boundary.
  const normalizedVenueLinks = () => ({
    WEBSITE: normalizeOptionalUrl(venueLinks.WEBSITE),
    INSTAGRAM: normalizeOptionalUrl(venueLinks.INSTAGRAM),
    FACEBOOK: normalizeOptionalUrl(venueLinks.FACEBOOK),
    TWITTER: normalizeOptionalUrl(venueLinks.TWITTER),
  });

  // `overrides` carry not-yet-committed values (a field that just changed but
  // whose setState hasn't flushed) and win over the state-derived base, so
  // change-handler validation sees the new value rather than the stale one.
  const buildStepValues = (step: Step, overrides: Record<string, unknown> = {}) => {
    if (step === 1) return { venueName, contactEmail: contactEmail || undefined, ...overrides };
    if (step === 2)
      return {
        address,
        lat: lat ?? undefined,
        lng: lng ?? undefined,
        bio: bio || undefined,
        ...overrides,
      };
    return { venueLinks: normalizedVenueLinks(), ...overrides };
  };

  const validateStep = (
    step: Step,
    currentTouched: Set<string> = touched,
    overrides: Record<string, unknown> = {}
  ): boolean => {
    const schema =
      step === 1
        ? venueOnboardingStep1Schema
        : step === 2
          ? venueOnboardingStep2Schema
          : venueOnboardingStep3Schema;
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

  // Set the venue location from the map pin. A pin always yields valid
  // coordinates and a non-empty address, so clear the location errors directly
  // rather than re-running validateStep against not-yet-committed state.
  const setLocation = ({
    lat: newLat,
    lng: newLng,
    address: newAddress,
  }: {
    lat: number;
    lng: number;
    address: string;
  }) => {
    setLat(newLat);
    setLng(newLng);
    setAddress(newAddress);
    setTouched((prev) => new Set(prev).add('lat').add('lng').add('address'));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.lat;
      delete next.lng;
      delete next.address;
      return next;
    });
  };

  const goNext = async () => {
    const newTouched = markStepTouched(currentStep);

    if (currentStep === 3) {
      if (!validateStep(3, newTouched)) return;
      await handleSubmit();
      return;
    }

    // Step 1 also carries the permanent handle (set via updateUser, outside the
    // step schema) — gate advancement on it too.
    if (currentStep === 1) username.markTouched();
    const stepValid = validateStep(currentStep, newTouched);
    const usernameOk = currentStep !== 1 || username.canSubmit;
    if (stepValid && usernameOk) {
      // Only on a validated advance — see the artist hook for the reasoning.
      track(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, { role: 'venue', step: currentStep });
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

  // Once a field has been touched (e.g. a failed Next surfaced its error),
  // re-validate it on every change so the error clears the instant the value
  // becomes valid — not only on the next blur or Next-press. The new value is
  // passed through to validateStep because setState is batched.
  const handleVenueNameChange = (value: string) => {
    setVenueName(value);
    if (touched.has('venueName')) validateStep(1, touched, { venueName: value });
  };

  const handleBioChange = (value: string) => {
    setBio(value);
    if (touched.has('bio')) validateStep(2, touched, { bio: value || undefined });
  };

  const handleVenueLinkChange = (field: keyof VenueLinks, value: string) => {
    const nextLinks = { ...venueLinks, [field]: value };
    setVenueLinks(nextLinks);
    if (touched.has(`venueLinks.${field}`)) {
      validateStep(3, touched, {
        venueLinks: {
          WEBSITE: nextLinks.WEBSITE || undefined,
          INSTAGRAM: nextLinks.INSTAGRAM || undefined,
          FACEBOOK: nextLinks.FACEBOOK || undefined,
          TWITTER: nextLinks.TWITTER || undefined,
        },
      });
    }
  };

  const handlePickImage = async () => {
    setImageError(null);
    try {
      const permission = await requestPhotoLibraryPermission();
      if (!permission.granted) {
        setImageError(
          permission.canAskAgain
            ? 'Photo library access is required to upload a venue/festival picture.'
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

    const parsed = createVenueOnboardingSchema.safeParse({
      venueName,
      address,
      lat: lat ?? undefined,
      lng: lng ?? undefined,
      bio: bio || undefined,
      contactEmail: contactEmail || undefined,
      venueLinks: normalizedVenueLinks(),
      profileImageUrl,
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        fieldErrors[issue.path.join('.')] = issue.message;
      }
      setErrors(fieldErrors);
      const stepWithError = ([1, 2, 3] as const).find((s) =>
        FIELDS_BY_STEP[s].some((f) => fieldErrors[f])
      );
      if (stepWithError && stepWithError !== currentStep) setCurrentStep(stepWithError);
      return;
    }

    try {
      // Claim the permanent handle on the user row first. The DB unique index is
      // the real backstop against a race; a rejection means it was just taken.
      const handleRes = await authClient.updateUser({
        username: username.value,
        displayUsername: username.value,
      });
      if (handleRes.error) {
        setSubmitError('That username was just taken — please pick another.');
        setCurrentStep(1);
        return;
      }

      await createVenueProfile(parsed.data);
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
      // Straight to the activation hand-off, which sends the email and explains the one
      // remaining step (M8). A venue used to land on the map with nothing said and nothing
      // sent, and discovered the requirement only by opening its own profile later.
      //
      // No success toast here: the screen's first line is "Your venue profile is created",
      // so a toast saying the same thing over the top of it is noise. The route lives under
      // (auth) on purpose — see that layout's exempt list.
      router.replace('/(auth)/venue-activation');
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
          FORBIDDEN: "Your account isn't set up as a venue/festival. Please contact support.",
        })
      );
    }
  };

  return {
    // fields
    venueName,
    setVenueName: handleVenueNameChange,
    username: username.value,
    setUsername: username.setValue,
    usernameStatus: username.status,
    usernameError: username.error,
    bio,
    setBio: handleBioChange,
    address,
    lat,
    lng,
    setLocation,
    contactEmail,
    setContactEmail,
    venueLinks,
    handleVenueLinkChange,
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
