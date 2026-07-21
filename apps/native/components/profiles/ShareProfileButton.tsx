import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Keyboard, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { appToast } from '@/components/AppToast';
import { UsernameField } from '@/components/onboarding/UsernameField';
import { useMe } from '@/hooks/use-me';
import { useShareProfile } from '@/hooks/use-share-profile';
import { useUsernameField } from '@/hooks/use-username-field';
import { authClient } from '@/lib/auth-client';
import { trpc } from '@/utils/trpc';

/**
 * Share button for the signed-in artist/venue's OWN profile.
 *
 * Renders only when the profile is live (an artist/venue profile exists —
 * spectators have no public profile and never see it). If the account has no
 * handle yet, the first tap opens a one-time picker (set-on-first-share): the
 * user claims a permanent handle, then the native Share sheet fires with
 * `ceolx.com/u/<handle>`. Once set, tapping shares immediately.
 */
export function ShareProfileButton() {
  const { data: me } = useMe();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const shareProfile = useShareProfile();
  const username = useUsernameField();
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // RN Modal opens its own native window that ignores the activity's
  // adjustResize, and both KeyboardAvoidingView behaviors misbehave for a
  // bottom sheet on Android (`padding` leaves a persistent gap when closed,
  // `height` collapses the sheet when open). So drive the lift ourselves:
  // fold the live keyboard height into the sheet's paddingBottom.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) =>
      setKeyboardHeight(e.endCoordinates.height)
    );
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const displayName =
    me?.artistProfile?.stageName ?? me?.venueProfile?.venueName ?? me?.name ?? 'me';
  const isLive = !!(me?.artistProfile || me?.venueProfile);
  const handle = me?.username ?? null;

  const onPress = useCallback(() => {
    if (handle) void shareProfile(handle, displayName);
    else setModalOpen(true);
  }, [handle, shareProfile, displayName]);

  // Dismiss the keyboard AND close the sheet together. Wired to Cancel via
  // onPressIn (touch-down): tapping while the keyboard is open dismisses it,
  // which fires keyboardDidHide → the sheet relayouts and the button shifts, so
  // an onPress (touch-up) would be cancelled by the move and only the keyboard
  // would close. Acting on touch-down beats that race, so one tap closes both.
  const closeModal = useCallback(() => {
    Keyboard.dismiss();
    setModalOpen(false);
  }, []);

  const onConfirm = useCallback(async () => {
    if (!username.canSubmit) {
      username.markTouched();
      return;
    }
    setSaving(true);
    const res = await authClient.updateUser({
      username: username.value,
      displayUsername: username.value,
    });
    setSaving(false);
    if (res.error) {
      appToast.error('Username taken', 'Please pick another.');
      return;
    }
    // Reconcile so the button now knows the handle (and any future tap shares).
    await queryClient.invalidateQueries({ queryKey: trpc.users.me.queryKey() });
    setModalOpen(false);
    void shareProfile(username.value, displayName);
  }, [username, queryClient, shareProfile, displayName]);

  if (!isLive) return null;

  return (
    <>
      <Pressable
        onPress={onPress}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Share profile"
        className="h-9 w-9 items-center justify-center"
      >
        <Ionicons name="share-outline" size={22} color="#fff" />
      </Pressable>

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={closeModal}>
        <View className="flex-1 justify-end bg-black/60">
          <View
            className="gap-5 rounded-t-3xl bg-[#141414] px-6 pt-6"
            style={{ paddingBottom: (keyboardHeight || insets.bottom) + 16 }}
          >
            <View className="gap-1">
              <Text className="text-xl font-bold text-white">Claim your handle</Text>
              <Text className="text-sm text-white/60">
                Pick a username to create your shareable profile link. This is permanent.
              </Text>
            </View>

            <UsernameField
              value={username.value}
              onChangeText={username.setValue}
              status={username.status}
              error={username.error}
            />

            {/* Footer mirrors the onboarding StepNavButtons pattern: outlined
                secondary + filled primary (#6155F5), rounded-full, uppercase,
                primary wider. */}
            <View className="flex-row gap-3">
              <Pressable
                onPressIn={closeModal}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                className="h-12 flex-1 items-center justify-center rounded-full"
                style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}
              >
                <Text className="text-base font-bold uppercase tracking-wide text-white">
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={onConfirm}
                disabled={saving || !username.canSubmit}
                accessibilityRole="button"
                accessibilityLabel="Claim and share"
                className="h-12 flex-row items-center justify-center gap-2 rounded-full"
                style={{
                  flex: 2,
                  backgroundColor: '#6155F5',
                  opacity: saving || !username.canSubmit ? 0.5 : 1,
                }}
              >
                {saving ? <ActivityIndicator size="small" color="#fff" /> : null}
                <Text className="text-base font-bold uppercase tracking-wide text-white">
                  Claim & Share
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
