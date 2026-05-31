import { useMutation, useQueryClient } from '@tanstack/react-query';
import { launchImageLibraryAsync, requestMediaLibraryPermissionsAsync } from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import type { EventCategory } from '@CeolX/shared';
import { isValidCoordinate } from '@CeolX/shared';
import { createEventSchema } from '@CeolX/shared/validators';

import { keyFromCdnUrl, useMediaDelete } from '@/hooks/use-media-delete';
import { useMediaUpload } from '@/hooks/use-media-upload';
import { trpc } from '@/utils/trpc';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EventFormData {
  // Step 1 — Basic Details
  title: string;
  description: string;
  coverImageUri: string | null;
  category: EventCategory | '';
  collectionId: string;
  platformInvites: string[];
  unregisteredCollaborators: Array<{ name: string; email: string }>;

  // Step 2 — Date & Venue
  dateStart: Date | null;
  dateEnd: Date | null;
  startTime: Date | null;
  endTime: Date | null;
  lat: number | null;
  lng: number | null;
  venueAddress: string;
  venueId: string;

  // Step 3 — Ticket & Ads
  ticketPrice: string;
  ticketLink: string;
  ticketQuantity: string;
  adTitle: string;
  adDescription: string;
}

type Step = 1 | 2 | 3;

interface UseEventFormOptions {
  /** If provided, the form operates in edit mode. */
  eventId?: string;
  /** Pre-populated data for edit mode. */
  initialData?: EventFormData;
  /** Called after a successful create or update. */
  onSuccess?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaults(initial?: EventFormData): EventFormData {
  return {
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    coverImageUri: initial?.coverImageUri ?? null,
    category: initial?.category ?? '',
    collectionId: initial?.collectionId ?? '',
    platformInvites: initial?.platformInvites ?? [],
    unregisteredCollaborators: initial?.unregisteredCollaborators ?? [],

    dateStart: initial?.dateStart ?? null,
    dateEnd: initial?.dateEnd ?? null,
    startTime: initial?.startTime ?? null,
    endTime: initial?.endTime ?? null,
    lat: initial?.lat ?? null,
    lng: initial?.lng ?? null,
    venueAddress: initial?.venueAddress ?? '',
    venueId: initial?.venueId ?? '',

    ticketPrice: initial?.ticketPrice ?? '',
    ticketLink: initial?.ticketLink ?? '',
    ticketQuantity: initial?.ticketQuantity ?? '',
    adTitle: initial?.adTitle ?? '',
    adDescription: initial?.adDescription ?? '',
  };
}

/**
 * Merge a Date (date portion) with a Date (time portion) into an ISO-8601
 * datetime string. Returns undefined when either part is missing.
 */
function combineDateAndTime(date: Date | null, time: Date | null): string | undefined {
  if (!date || !time) return undefined;

  const combined = new Date(date);
  combined.setHours(time.getHours(), time.getMinutes(), time.getSeconds(), 0);
  return combined.toISOString();
}

/**
 * Convert a user-entered price string (e.g. "12.50") to cents (1250).
 * Returns undefined for empty / invalid input.
 */
function priceToCents(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = parseFloat(value);
  if (Number.isNaN(parsed) || parsed < 0) return undefined;
  return Math.round(parsed * 100);
}

/**
 * Convert a user-entered quantity string to an integer.
 * Returns undefined for empty / invalid input.
 */
function parseQuantity(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) return undefined;
  return parsed;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useEventForm(options?: UseEventFormOptions) {
  const isEditing = !!options?.eventId;
  const queryClient = useQueryClient();

  const init = defaults(options?.initialData);

  // Step tracker
  const [currentStep, setCurrentStep] = useState<Step>(1);

  // Step 1 — Basic Details
  const [title, setTitle] = useState(init.title);
  const [description, setDescription] = useState(init.description);
  const [coverImageUri, setCoverImageUri] = useState<string | null>(init.coverImageUri);
  const [category, setCategory] = useState<EventCategory | ''>(init.category);
  const [collectionId, setCollectionId] = useState(init.collectionId);
  const [platformInvites, setPlatformInvites] = useState<string[]>(init.platformInvites);
  const [unregisteredCollaborators, setUnregisteredCollaborators] = useState<
    Array<{ name: string; email: string }>
  >(init.unregisteredCollaborators);

  // Step 2 — Date & Venue
  const [dateStart, setDateStart] = useState<Date | null>(init.dateStart);
  const [dateEnd, setDateEnd] = useState<Date | null>(init.dateEnd);
  const [startTime, setStartTime] = useState<Date | null>(init.startTime);
  const [endTime, setEndTime] = useState<Date | null>(init.endTime);
  const [lat, setLat] = useState<number | null>(init.lat);
  const [lng, setLng] = useState<number | null>(init.lng);
  const [venueAddress, setVenueAddress] = useState(init.venueAddress);
  const [venueId, setVenueId] = useState(init.venueId);

  // Step 3 — Ticket & Ads
  const [ticketPrice, setTicketPrice] = useState(init.ticketPrice);
  const [ticketLink, setTicketLink] = useState(init.ticketLink);
  const [ticketQuantity, setTicketQuantity] = useState(init.ticketQuantity);
  const [adTitle, setAdTitle] = useState(init.adTitle);
  const [adDescription, setAdDescription] = useState(init.adDescription);

  // Validation errors (keyed by field path)
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fields the user has interacted with — a text field they've left (blurred),
  // or a picker/date/location they've chosen a value for. Drives the
  // "stay silent until they leave a field, then keep it live" behaviour: only
  // touched fields are validated in real time, so we never nag mid-typing.
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const markTouched = useCallback((field: string) => {
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }, []);

  // Mutations
  const createMutation = useMutation(trpc.events.create.mutationOptions());
  const updateMutation = useMutation(trpc.events.update.mutationOptions());

  // Media pipeline — cover image is uploaded to s3 at submit time. The
  // original CDN URL (edit mode) is captured so we can clean up the old
  // s3 object after a successful replace.
  const coverUpload = useMediaUpload('event_cover');
  const { cleanupAfterDelete } = useMediaDelete();
  const initialCoverImage = options?.initialData?.coverImageUri ?? null;

  const isPending = createMutation.isPending || updateMutation.isPending || coverUpload.isUploading;

  // ---------------------------------------------------------------------------
  // Cover image picker
  // ---------------------------------------------------------------------------

  const pickCoverImage = useCallback(async () => {
    const perm = await requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }

    const result = await launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      const uri = result.assets[0]?.uri;
      if (uri) setCoverImageUri(uri);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Validation — one rule per field, shared by blur, change and the Next gate
  // ---------------------------------------------------------------------------

  // Returns the error message for a single field, or undefined when valid.
  // On-blur, on-change (for touched fields) and the on-Next step checks all go
  // through here so the rules can never drift apart.
  const fieldError = useCallback(
    (field: string): string | undefined => {
      switch (field) {
        case 'title': {
          const value = title.trim();
          if (!value || value.length < 3) return 'Title must be at least 3 characters';
          if (value.length > 150) return 'Title must be at most 150 characters';
          return undefined;
        }
        case 'description': {
          const value = description.trim();
          if (!value || value.length < 10) return 'Description must be at least 10 characters';
          if (value.length > 2000) return 'Description must be at most 2000 characters';
          return undefined;
        }
        case 'category':
          return category ? undefined : 'Category is required';
        case 'dateStart':
          return dateStart ? undefined : 'Start date is required';
        case 'startTime':
          return startTime ? undefined : 'Start time is required';
        case 'lat':
          // Map and feed are coordinate-driven, so an event needs a real pin.
          // A free-text address alone is not enough — the user must drop a pin
          // or pick a registered venue (whose stored pin the server inherits).
          // isValidCoordinate also rejects null-island (0,0), so a failed
          // geocode can no longer slip through as a "valid" location.
          return !isValidCoordinate(lat, lng) && !venueId
            ? 'A location pin or a registered venue is required'
            : undefined;
        default:
          return undefined;
      }
    },
    [title, description, category, dateStart, startTime, lat, lng, venueId]
  );

  // Re-validate every already-touched field whenever any value changes, so an
  // error clears the instant the user fixes it (and updates if still invalid).
  // Untouched fields are skipped — they stay silent until the user reaches them.
  useEffect(() => {
    setErrors((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const field of Object.keys(touched)) {
        const err = fieldError(field);
        if (err) {
          if (next[field] !== err) {
            next[field] = err;
            changed = true;
          }
        } else if (field in next) {
          delete next[field];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [touched, fieldError]);

  // Text fields validate when the user leaves them; the effect above then keeps
  // them live as the user edits to fix the error.
  const handleBlur = useCallback(
    (field: string) => {
      markTouched(field);
    },
    [markTouched]
  );

  // The Next / Submit gate: validate a set of fields together, mark them all
  // touched (so later edits re-validate in real time) and merge the result into
  // the error map.
  const validateFields = useCallback(
    (fields: string[]): boolean => {
      const computed = fields.map((field) => [field, fieldError(field)] as const);
      const ok = computed.every(([, err]) => !err);

      setErrors((prev) => {
        const next = { ...prev };
        for (const [field, err] of computed) {
          if (err) next[field] = err;
          else delete next[field];
        }
        return next;
      });
      setTouched((prev) => {
        const next = { ...prev };
        for (const field of fields) next[field] = true;
        return next;
      });
      return ok;
    },
    [fieldError]
  );

  const validateStep1 = useCallback(
    (): boolean => validateFields(['title', 'description', 'category']),
    [validateFields]
  );

  const validateStep2 = useCallback(
    (): boolean => validateFields(['dateStart', 'startTime', 'lat']),
    [validateFields]
  );

  const validateStep3 = useCallback((): boolean => {
    // All Step 3 fields are optional — always valid.
    return true;
  }, []);

  const validateCurrentStep = useCallback((): boolean => {
    switch (currentStep) {
      case 1:
        return validateStep1();
      case 2:
        return validateStep2();
      case 3:
        return validateStep3();
      default:
        return false;
    }
  }, [currentStep, validateStep1, validateStep2, validateStep3]);

  // Discrete fields (pickers, date/time, location) have no "blur" — choosing a
  // value IS the interaction, so mark them touched on change. The effect then
  // validates immediately, clearing the error the moment a value is selected.
  const handleCategoryChange = useCallback(
    (value: EventCategory) => {
      setCategory(value);
      markTouched('category');
    },
    [markTouched]
  );

  const handleDateStartChange = useCallback(
    (value: Date) => {
      setDateStart(value);
      markTouched('dateStart');
    },
    [markTouched]
  );

  const handleStartTimeChange = useCallback(
    (value: Date) => {
      setStartTime(value);
      markTouched('startTime');
    },
    [markTouched]
  );

  // Both the map pin and the free-text venue address satisfy the same "lat"
  // location rule, so either one being set clears that error.
  const handleLatChange = useCallback(
    (value: number | null) => {
      setLat(value);
      markTouched('lat');
    },
    [markTouched]
  );

  const handleLngChange = useCallback(
    (value: number | null) => {
      setLng(value);
      markTouched('lat');
    },
    [markTouched]
  );

  const handleVenueAddressChange = useCallback(
    (value: string) => {
      setVenueAddress(value);
      markTouched('lat');
    },
    [markTouched]
  );

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  const goNext = useCallback(() => {
    if (!validateCurrentStep()) return;
    setCurrentStep((prev) => (prev < 3 ? ((prev + 1) as Step) : prev));
  }, [validateCurrentStep]);

  const goBack = useCallback(() => {
    setErrors({});
    setCurrentStep((prev) => (prev > 1 ? ((prev - 1) as Step) : prev));
  }, []);

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const handleSubmit = useCallback(async () => {
    // Run all step validations upfront. Errors from earlier steps may not be
    // visible on step 3's UI, so we navigate back to the first failing step
    // and surface an alert so the user knows what to fix.
    const step1Ok = validateStep1();
    const step2Ok = validateStep2();
    const step3Ok = validateStep3();

    if (!step1Ok) {
      setCurrentStep(1);
      Alert.alert('Missing details', 'Please fix the errors on step 1 before submitting.');
      return;
    }
    if (!step2Ok) {
      setCurrentStep(2);
      Alert.alert('Missing details', 'Please fix the errors on step 2 before submitting.');
      return;
    }
    if (!step3Ok) {
      return;
    }

    const dateStartISO = combineDateAndTime(dateStart, startTime);
    const dateEndISO = combineDateAndTime(dateEnd ?? dateStart, endTime);

    // If the user picked a new local image, upload it first and use the
    // returned CDN url in the payload. CDN urls (https://...) are passed
    // through unchanged. Failure here aborts the submit so we don't
    // persist a stale or empty cover.
    let finalCoverImage: string | undefined = coverImageUri ?? undefined;
    if (coverImageUri && !coverImageUri.startsWith('https://')) {
      try {
        const { cdnUrl } = await coverUpload.uploadMedia({ uri: coverImageUri });
        finalCoverImage = cdnUrl;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Image upload failed.';
        Alert.alert('Upload failed', message);
        return;
      }
    }

    const payload = {
      title: title.trim(),
      description: description.trim(),
      coverImage: finalCoverImage,
      dateStart: dateStartISO ?? new Date().toISOString(),
      dateEnd: dateEndISO,
      lat: lat ?? undefined,
      lng: lng ?? undefined,
      venueId: venueId || undefined,
      venueAddress: venueAddress.trim() || undefined,
      category: category as EventCategory,
      ticketLink: ticketLink.trim() || undefined,
      ticketPrice: priceToCents(ticketPrice),
      ticketQuantity: parseQuantity(ticketQuantity),
      collectionId: collectionId || undefined,
      platformInvites: platformInvites.length > 0 ? platformInvites : undefined,
      unregisteredCollaborators:
        unregisteredCollaborators.length > 0 ? unregisteredCollaborators : undefined,
      adTitle: adTitle.trim() || undefined,
      adDescription: adDescription.trim() || undefined,
    };

    // Final Zod validation against the shared schema
    const parsed = createEventSchema.safeParse(payload);

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        fieldErrors[issue.path.join('.')] = issue.message;
      }
      setErrors(fieldErrors);
      // Navigate back to step 1 so the field errors are actually visible
      setCurrentStep(1);
      Alert.alert(
        'Invalid event data',
        parsed.error.issues[0]?.message ?? 'Please check all fields.'
      );
      return;
    }

    try {
      if (isEditing && options?.eventId) {
        await updateMutation.mutateAsync({
          id: options.eventId,
          data: parsed.data,
        });
      } else {
        await createMutation.mutateAsync(parsed.data);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      Alert.alert('Failed to save event', message);
      return;
    }

    // Best-effort cleanup of the old cover image when the user replaced
    // it on edit. Fire-and-forget — the save already succeeded, and s3
    // lifecycle (90-day expiry) catches anything we miss here.
    if (initialCoverImage && initialCoverImage !== finalCoverImage) {
      const oldKey = keyFromCdnUrl(initialCoverImage);
      if (oldKey) {
        cleanupAfterDelete({ key: oldKey }).catch((err) => {
          console.warn('[event-form] failed to clean up replaced cover image', err);
        });
      }
    }

    // Invalidate cached event queries so detail/feed/map show updated data
    void queryClient.invalidateQueries({ queryKey: [['events']] });

    options?.onSuccess?.();
  }, [
    validateStep1,
    validateStep2,
    validateStep3,
    dateStart,
    dateEnd,
    startTime,
    endTime,
    title,
    description,
    coverImageUri,
    coverUpload,
    initialCoverImage,
    cleanupAfterDelete,
    lat,
    lng,
    venueId,
    venueAddress,
    category,
    ticketLink,
    ticketPrice,
    ticketQuantity,
    collectionId,
    platformInvites,
    unregisteredCollaborators,
    adTitle,
    adDescription,
    isEditing,
    options?.eventId,
    updateMutation,
    createMutation,
  ]);

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    // Step 1 — Basic Details
    title,
    setTitle,
    description,
    setDescription,
    coverImageUri,
    setCoverImageUri,
    pickCoverImage,
    isUploadingCover: coverUpload.isUploading,
    coverUploadProgress: coverUpload.progress,
    category,
    setCategory: handleCategoryChange,
    collectionId,
    setCollectionId,
    platformInvites,
    setPlatformInvites,
    unregisteredCollaborators,
    setUnregisteredCollaborators,

    // Step 2 — Date & Venue
    dateStart,
    setDateStart: handleDateStartChange,
    dateEnd,
    setDateEnd,
    startTime,
    setStartTime: handleStartTimeChange,
    endTime,
    setEndTime,
    lat,
    setLat: handleLatChange,
    lng,
    setLng: handleLngChange,
    venueAddress,
    setVenueAddress: handleVenueAddressChange,
    venueId,
    setVenueId,

    // Step 3 — Ticket & Ads
    ticketPrice,
    setTicketPrice,
    ticketLink,
    setTicketLink,
    ticketQuantity,
    setTicketQuantity,
    adTitle,
    setAdTitle,
    adDescription,
    setAdDescription,

    // Wizard state
    currentStep,
    errors,
    handleBlur,
    isEditing,
    isPending,

    // Navigation & submission
    goNext,
    goBack,
    handleSubmit,
  };
}
