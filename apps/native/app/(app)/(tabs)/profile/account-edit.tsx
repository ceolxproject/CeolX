import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { cn } from 'heroui-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { AppTextField } from '@/components/AppTextField';
import { appToast } from '@/components/AppToast';
import { ProfilePicture } from '@/components/onboarding/ProfilePicture';
import { useMe } from '@/hooks/use-me';
import { keyFromCdnUrl, useMediaDelete } from '@/hooks/use-media-delete';
import { useMediaUpload } from '@/hooks/use-media-upload';
import { useUpdateAccount } from '@/hooks/use-update-account';
import { pickSquarePhoto, requestPhotoLibraryPermission } from '@/utils/image-picker';
import { getTRPCErrorMessage } from '@/utils/trpc-error';

const NAME_MAX_LENGTH = 100;

/**
 * Spectator "Update Profile" screen (Figma 1:6851). A spectator has no
 * artist/venue profile row, so name + avatar live on the `user` table and are
 * saved via users.updateMe. Email is shown read-only — it is immutable.
 */
export default function AccountEditScreen() {
  const { data: me } = useMe();
  const updateAccount = useUpdateAccount();
  const { uploadMedia, isUploading: isImageUploading } = useMediaUpload('profile_image');
  const { deleteS3Object } = useMediaDelete();

  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);

  // Mirrors edit.tsx: `imageUri` is what's shown (existing CDN url or a freshly
  // picked local file); `originalImageUrl` is the persisted url we diff against
  // to decide upload vs. clear vs. no-change; `imageTouched` gates all three so
  // an untouched avatar is left exactly as-is on save.
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [imageTouched, setImageTouched] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // Prefill from the current user. Spectators store name/image on `user`.
  useEffect(() => {
    if (!me) return;
    setName(me.name ?? '');
    setOriginalImageUrl(me.image ?? null);
    setImageUri(me.image ?? null);
  }, [me]);

  const trimmedName = name.trim();
  const nameError = nameTouched && !trimmedName ? 'Name is required' : null;
  const isBusy = updateAccount.isPending || isImageUploading;
  const isSaveDisabled = !trimmedName || isBusy;

  const handlePickImage = async () => {
    setImageError(null);
    try {
      const permission = await requestPhotoLibraryPermission();
      if (!permission.granted) {
        setImageError(
          permission.canAskAgain
            ? 'Photo library access is required to change your picture.'
            : 'Photo access is disabled. Enable it in Settings > CeolX.'
        );
        return;
      }
      const uri = await pickSquarePhoto();
      if (uri) {
        setImageUri(uri);
        setImageTouched(true);
      }
    } catch {
      setImageError("Couldn't open the photo library. Please try again.");
    }
  };

  const handleRemoveImage = () => {
    setImageUri(null);
    setImageTouched(true);
    setImageError(null);
  };

  const handleSave = async () => {
    setNameTouched(true);
    if (!trimmedName) {
      appToast.warning('Required', 'Please enter your name.');
      return;
    }

    // Resolve the image change first so a failed upload aborts before we write
    // the name. undefined => leave unchanged; null => clear; string => new url.
    let image: string | null | undefined;
    if (imageTouched) {
      if (imageUri && imageUri !== originalImageUrl) {
        try {
          const { cdnUrl } = await uploadMedia({ uri: imageUri });
          image = cdnUrl;
        } catch (err) {
          setImageError(err instanceof Error ? err.message : 'Image upload failed');
          return;
        }
      } else if (!imageUri) {
        image = null;
      }
    }

    try {
      await updateAccount.mutateAsync({ name: trimmedName, image });

      // Best-effort: drop the previous S3 object once the new url (or cleared
      // state) is persisted. Orphan cleanup only — never block the save on it.
      if (imageTouched && originalImageUrl && originalImageUrl !== imageUri) {
        const key = keyFromCdnUrl(originalImageUrl);
        if (key) {
          try {
            await deleteS3Object(key);
          } catch {
            // S3 lifecycle expiry is the safety net; ignore delete failures.
          }
        }
      }

      appToast.success('Profile updated', 'Your changes are saved.');
      router.back();
    } catch (err) {
      appToast.error(
        'Update failed',
        getTRPCErrorMessage(
          err,
          { BAD_REQUEST: 'Please check the entered values and try again.' },
          'Failed to update profile. Please try again.'
        )
      );
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }} edges={['top']}>
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <AppHeader leading="back" title="Update Profile" titleSize="display" />

        <ScrollView
          className="flex-1 px-6"
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Profile Image */}
          <View className="items-center mb-8">
            <ProfilePicture
              uri={imageUri}
              label={imageUri ? 'Change Profile Picture' : 'Upload Profile Picture'}
              onPress={handlePickImage}
              onRemove={handleRemoveImage}
            />
            {imageError ? (
              <Text className="mt-2 text-xs text-red-400 font-urbanist text-center">
                {imageError}
              </Text>
            ) : null}
          </View>

          {/* Full Name */}
          <Text className="text-sm font-bold text-white/80 font-urbanist mb-2">Full Name</Text>
          <AppTextField
            variant="light"
            containerClassName="mb-4"
            placeholder="First & Last Name"
            value={name}
            onChangeText={setName}
            onBlur={() => setNameTouched(true)}
            error={nameError ?? undefined}
            maxLength={NAME_MAX_LENGTH}
            autoCapitalize="words"
            returnKeyType="done"
          />

          {/* Contact Email — read-only. Email is immutable for all accounts. */}
          <Text className="text-sm font-bold text-white/80 font-urbanist mb-2">Contact Email</Text>
          <AppTextField
            variant="light"
            containerClassName="mb-8"
            fieldClassName="bg-[#ECECEC]"
            className="text-[#8d8d8d]"
            value={me?.email ?? ''}
            editable={false}
            selectTextOnFocus={false}
            rightAdornment={<Ionicons name="lock-closed" size={18} color="#8d8d8d" />}
          />

          {/* Update Profile */}
          <Pressable
            onPress={handleSave}
            disabled={isSaveDisabled}
            className={cn(
              'h-[52px] rounded-full bg-blue-10 flex-row items-center justify-center',
              isSaveDisabled && 'opacity-50'
            )}
          >
            {isBusy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text className="text-base font-bold text-white uppercase tracking-wider font-urbanist">
                Update Profile
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
