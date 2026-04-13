import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';

import { createVenueOnboardingSchema } from '@CeolX/shared/validators';

import type { VenueLinks } from '@/components/onboarding/VenueLinksSection';
import { useAuth } from '@/contexts/auth-context';
import { pickSquarePhoto, requestPhotoLibraryPermission } from '@/utils/image-picker';
import { trpc } from '@/utils/trpc';
import { getTRPCErrorMessage } from '@/utils/trpc-error';

const BIO_MAX = 50;

interface UseVenueOnboardingReturn {
  venueName: string;
  setVenueName: (v: string) => void;
  bio: string;
  setBio: (v: string) => void;
  BIO_MAX: number;
  address: string;
  setAddress: (v: string) => void;
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
  handleSubmit: () => Promise<void>;
}

export function useVenueOnboarding(): UseVenueOnboardingReturn {
  const { user } = useAuth();

  const [venueName, setVenueName] = useState('');
  const [bio, setBio] = useState('');
  const [address, setAddress] = useState('');
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
  const queryClient = useQueryClient();

  const { mutateAsync: createVenueProfile, isPending } = useMutation(
    trpc.onboarding.createVenueProfile.mutationOptions()
  );

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

  const handleSubmit = async () => {
    setSubmitError(null);
    setErrors({});

    const parsed = createVenueOnboardingSchema.safeParse({
      venueName,
      address,
      bio: bio || undefined,
      contactEmail: contactEmail || undefined,
      venueLinks: {
        WEBSITE: venueLinks.WEBSITE || undefined,
        INSTAGRAM: venueLinks.INSTAGRAM || undefined,
        FACEBOOK: venueLinks.FACEBOOK || undefined,
        TWITTER: venueLinks.TWITTER || undefined,
      },
      // TODO M10: upload image to S3 and pass the CDN URL as profileImageUrl
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        fieldErrors[issue.path.join('.')] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    try {
      await createVenueProfile(parsed.data);
      await queryClient.invalidateQueries({ queryKey: trpc.users.me.queryKey() });
      router.replace('/(app)/(tabs)/map');
    } catch (err: unknown) {
      setSubmitError(
        getTRPCErrorMessage(err, {
          CONFLICT: 'A venue profile already exists for this account. Please sign in.',
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
    setAddress,
    contactEmail,
    setContactEmail,
    venueLinks,
    handleVenueLinkChange,
    profileImageUri,
    imageError,
    // state
    errors,
    submitError,
    isPending,
    // handlers
    handlePickImage,
    handleSubmit,
  };
}
