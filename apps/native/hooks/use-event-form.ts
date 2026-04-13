import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import type { EventCategory } from '@CeolX/shared';
import { createEventSchema } from '@CeolX/shared/validators';

import { trpc } from '@/utils/trpc';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Full artist object stored alongside collaborator IDs so the picker can
 *  re-hydrate its chip display after the component remounts (step navigation). */
export type CollaboratorArtist = {
  id: string;
  stageName: string;
  genre: string | null;
  image: string | null;
};

export interface EventFormData {
  // Step 1 — Basic Details
  title: string;
  description: string;
  coverImageUri: string | null;
  category: EventCategory | '';
  collectionId: string;
  collaborators: string[];
  collaboratorArtists: CollaboratorArtist[];
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
  /** Current user role — used to enforce persona-specific mandatory fields. */
  isVenue?: boolean;
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
    collaborators: initial?.collaborators ?? [],
    collaboratorArtists: initial?.collaboratorArtists ?? [],
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
  const isVenue = options?.isVenue ?? false;
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
  const [collaborators, setCollaborators] = useState<string[]>(init.collaborators);
  const [collaboratorArtists, setCollaboratorArtists] = useState<CollaboratorArtist[]>(
    init.collaboratorArtists
  );
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

  // Mutations
  const createMutation = useMutation(trpc.events.create.mutationOptions());
  const updateMutation = useMutation(trpc.events.update.mutationOptions());

  const isPending = createMutation.isPending || updateMutation.isPending;

  // ---------------------------------------------------------------------------
  // Validation helpers (per-step)
  // ---------------------------------------------------------------------------

  const validateStep1 = useCallback((): boolean => {
    const stepErrors: Record<string, string> = {};

    if (!title.trim() || title.trim().length < 3) {
      stepErrors.title = 'Title must be at least 3 characters';
    } else if (title.trim().length > 150) {
      stepErrors.title = 'Title must be at most 150 characters';
    }

    if (!description.trim() || description.trim().length < 10) {
      stepErrors.description = 'Description must be at least 10 characters';
    } else if (description.trim().length > 2000) {
      stepErrors.description = 'Description must be at most 2000 characters';
    }

    if (!category) {
      stepErrors.category = 'Category is required';
    }

    if (isVenue && collaborators.length === 0) {
      stepErrors.collaborators = 'At least one confirmed collaborator is required for venue events';
    }

    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  }, [title, description, category, isVenue, collaborators]);

  const validateStep2 = useCallback((): boolean => {
    const stepErrors: Record<string, string> = {};

    if (!dateStart) {
      stepErrors.dateStart = 'Start date is required';
    }

    if (!startTime) {
      stepErrors.startTime = 'Start time is required';
    }

    if ((lat === null || lng === null) && !venueAddress.trim()) {
      stepErrors.lat = 'Either a location pin or venue address is required';
    }

    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  }, [dateStart, startTime, lat, lng, venueAddress]);

  const validateStep3 = useCallback((): boolean => {
    // All Step 3 fields are optional — always valid.
    setErrors({});
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
    // Run all step validations
    if (!validateStep1() || !validateStep2() || !validateStep3()) {
      return;
    }

    const dateStartISO = combineDateAndTime(dateStart, startTime);
    const dateEndISO = combineDateAndTime(dateEnd ?? dateStart, endTime);

    const payload = {
      title: title.trim(),
      description: description.trim(),
      coverImage: coverImageUri ?? undefined,
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
      collaborators: collaborators.length > 0 ? collaborators : undefined,
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
      return;
    }

    if (isEditing && options?.eventId) {
      await updateMutation.mutateAsync({
        id: options.eventId,
        data: parsed.data,
      });
    } else {
      await createMutation.mutateAsync(parsed.data);
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
    lat,
    lng,
    venueId,
    venueAddress,
    category,
    ticketLink,
    ticketPrice,
    ticketQuantity,
    collectionId,
    collaborators,
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
    category,
    setCategory,
    collectionId,
    setCollectionId,
    collaborators,
    setCollaborators,
    collaboratorArtists,
    setCollaboratorArtists,
    platformInvites,
    setPlatformInvites,
    unregisteredCollaborators,
    setUnregisteredCollaborators,

    // Step 2 — Date & Venue
    dateStart,
    setDateStart,
    dateEnd,
    setDateEnd,
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    lat,
    setLat,
    lng,
    setLng,
    venueAddress,
    setVenueAddress,
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
    isEditing,
    isPending,

    // Navigation & submission
    goNext,
    goBack,
    handleSubmit,
  };
}
