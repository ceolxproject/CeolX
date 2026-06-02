import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';

import {
  createVenueOnboardingSchema,
  venueOnboardingStep1Schema,
  venueOnboardingStep2Schema,
  venueOnboardingStep3Schema,
} from '@CeolX/shared/validators';

import { appToast } from '@/components/AppToast';
import type { VenueLinks } from '@/components/onboarding/VenueLinksSection';
import { useAuth } from '@/contexts/auth-context';
import { useMediaUpload } from '@/hooks/use-media-upload';
import { pickSquarePhoto, requestPhotoLibraryPermission } from '@/utils/image-picker';
import { trpc, type RouterOutputs } from '@/utils/trpc';
import { getTRPCErrorCode, getTRPCErrorMessage } from '@/utils/trpc-error';

const BIO_MAX = 50;

type Step = 1 | 2 | 3;

const FIELDS_BY_STEP: Record<Step, readonly string[]> = {
  1: ['venueName', 'contactEmail'],
  2: ['address', 'lat', 'lng', 'bio'],
  3: ['venueLinks.WEBSITE', 'venueLinks.INSTAGRAM', 'venueLinks.FACEBOOK', 'venueLinks.TWITTER'],
};

interface UseVenueOnboardingReturn {
  venueName: string;
  setVenueName: (v: string) => void;
  bio: string;
  setBio: (v: string) => void;
  BIO_MAX: number;
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

  // ── Step navigation ─────────────────────────────────────────────────────

  const buildStepValues = (step: Step) => {
    if (step === 1) return { venueName, contactEmail: contactEmail || undefined };
    if (step === 2)
      return { address, lat: lat ?? undefined, lng: lng ?? undefined, bio: bio || undefined };
    return {
      venueLinks: {
        WEBSITE: venueLinks.WEBSITE || undefined,
        INSTAGRAM: venueLinks.INSTAGRAM || undefined,
        FACEBOOK: venueLinks.FACEBOOK || undefined,
        TWITTER: venueLinks.TWITTER || undefined,
      },
    };
  };

  const validateStep = (step: Step, currentTouched: Set<string> = touched): boolean => {
    const schema =
      step === 1
        ? venueOnboardingStep1Schema
        : step === 2
          ? venueOnboardingStep2Schema
          : venueOnboardingStep3Schema;
    const result = schema.safeParse(buildStepValues(step));

    setErrors((prev) => {
      const next = { ...prev };
      for (const f of FIELDS_BY_STEP[step]) delete next[f];
      if (!result.success) {
        for (const issue of result.error.issues) {
          const field = issue.path.join('.');
          if (currentTouched.has(field)) next[field] = issue.message;
        }
      }
      return next;
    });

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

  const handleVenueLinkChange = (field: keyof VenueLinks, value: string) => {
    setVenueLinks((prev) => ({ ...prev, [field]: value }));
  };

  const handlePickImage = async () => {
    setImageError(null);
    try {
      const permission = await requestPhotoLibraryPermission();
      if (!permission.granted) {
        setImageError(
          permission.canAskAgain
            ? 'Photo library access is required to upload a venue picture.'
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
      venueLinks: {
        WEBSITE: venueLinks.WEBSITE || undefined,
        INSTAGRAM: venueLinks.INSTAGRAM || undefined,
        FACEBOOK: venueLinks.FACEBOOK || undefined,
        TWITTER: venueLinks.TWITTER || undefined,
      },
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
      await createVenueProfile(parsed.data);
      // Optimistically flip onboardingComplete so (app)/_layout's redirect
      // guard doesn't bounce us back on the next mount. invalidate runs in
      // the background to reconcile the rest of the me payload.
      queryClient.setQueryData<RouterOutputs['users']['me']>(trpc.users.me.queryKey(), (old) =>
        old ? { ...old, onboardingComplete: true } : old
      );
      void queryClient.invalidateQueries({ queryKey: trpc.users.me.queryKey() });
      appToast.success('Venue profile created', 'Welcome to CeolX!');
      router.replace('/(app)/(tabs)/map');
    } catch (err: unknown) {
      // If the server says the profile already exists, the user has finished
      // onboarding (possibly from a half-failed prior submit). Route them
      // forward instead of dead-ending on the form.
      if (getTRPCErrorCode(err) === 'CONFLICT') {
        queryClient.setQueryData<RouterOutputs['users']['me']>(trpc.users.me.queryKey(), (old) =>
          old ? { ...old, onboardingComplete: true } : old
        );
        void queryClient.invalidateQueries({ queryKey: trpc.users.me.queryKey() });
        router.replace('/(app)/(tabs)/map');
        return;
      }
      setSubmitError(
        getTRPCErrorMessage(err, {
          FORBIDDEN: "Your account isn't set up as a venue. Please contact support.",
        })
      );
    }
  };

  return {
    // fields
    venueName,
    setVenueName,
    bio,
    setBio,
    BIO_MAX,
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
    // step navigation
    currentStep,
    touched,
    goNext,
    goBack,
    goToStep,
    handleBlur,
  };
}
