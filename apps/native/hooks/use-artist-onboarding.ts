import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';

import { createArtistOnboardingSchema } from '@CeolX/shared/validators';

import type { SocialLinks } from '@/components/onboarding/SocialLinksSection';
import { useAuth } from '@/contexts/auth-context';
import { useMediaUpload } from '@/hooks/use-media-upload';
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
  const queryClient = useQueryClient();

  const { mutateAsync: createArtistProfile, isPending } = useMutation(
    trpc.onboarding.createArtistProfile.mutationOptions()
  );
  const { uploadMedia, isUploading: isImageUploading } = useMediaUpload('profile_image');

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

    // Upload the profile image first so we can pass the cdn url into the
    // shared validator. We do this before parsing because the schema may
    // require profileImageUrl — letting validation fail with "missing image"
    // before the upload runs would block submission needlessly.
    let profileImageUrl: string | undefined;
    if (profileImageUri) {
      try {
        const { cdnUrl } = await uploadMedia({ uri: profileImageUri });
        profileImageUrl = cdnUrl;
      } catch (err) {
        setImageError(err instanceof Error ? err.message : 'Image upload failed');
        return;
      }
    }

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
      profileImageUrl,
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
      await queryClient.invalidateQueries({ queryKey: trpc.users.me.queryKey() });
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
    isPending: isPending || isImageUploading,
    // handlers
    handlePickImage,
    handleSubmit,
  };
}
