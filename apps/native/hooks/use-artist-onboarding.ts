import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';

import { createArtistOnboardingSchema } from '@CeolX/shared/validators';

import type { SocialLinks } from '@/components/onboarding/SocialLinksSection';
import { useAuth } from '@/contexts/auth-context';
import { pickSquarePhoto, requestPhotoLibraryPermission } from '@/utils/image-picker';
import { trpc } from '@/utils/trpc';
import { getTRPCErrorMessage } from '@/utils/trpc-error';

export function useArtistOnboarding() {
  const { user } = useAuth();

  const [stageName, setStageName] = useState('');
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

  const { mutateAsync: createArtistProfile, isPending } = useMutation(
    trpc.onboarding.createArtistProfile.mutationOptions()
  );

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

  const handleSocialLinkChange = (field: keyof SocialLinks, value: string) => {
    setSocialLinks((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    setErrors({});

    const parsed = createArtistOnboardingSchema.safeParse({
      stageName,
      bio: bio || undefined,
      contactEmail: contactEmail || undefined,
      socialLinks: {
        INSTAGRAM: socialLinks.INSTAGRAM || undefined,
        FACEBOOK: socialLinks.FACEBOOK || undefined,
        TIKTOK: socialLinks.TIKTOK || undefined,
        YOUTUBE: socialLinks.YOUTUBE || undefined,
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
      await createArtistProfile(parsed.data);
      router.replace('/(app)/(tabs)/map');
    } catch (err: unknown) {
      setSubmitError(
        getTRPCErrorMessage(err, {
          CONFLICT: 'An artist profile already exists for this account. Please sign in.',
          FORBIDDEN: "Your account isn't set up as an artist. Please contact support.",
        })
      );
    }
  };

  return {
    // fields
    stageName,
    setStageName,
    bio,
    setBio,
    contactEmail,
    setContactEmail,
    socialLinks,
    handleSocialLinkChange,
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
