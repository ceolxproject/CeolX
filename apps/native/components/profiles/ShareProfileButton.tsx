import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';

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
  const queryClient = useQueryClient();
  const shareProfile = useShareProfile();
  const username = useUsernameField();
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const displayName =
    me?.artistProfile?.stageName ?? me?.venueProfile?.venueName ?? me?.name ?? 'me';
  const isLive = !!(me?.artistProfile || me?.venueProfile);
  const handle = me?.username ?? null;

  const onPress = useCallback(() => {
    if (handle) void shareProfile(handle, displayName);
    else setModalOpen(true);
  }, [handle, shareProfile, displayName]);

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

      <Modal
        visible={modalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setModalOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/60">
          <View className="gap-5 rounded-t-3xl bg-[#141414] p-6">
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

            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setModalOpen(false)}
                disabled={saving}
                className="h-[52px] flex-1 items-center justify-center rounded-lg bg-white/10"
              >
                <Text className="font-bold text-white">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={onConfirm}
                disabled={saving || !username.canSubmit}
                className="h-[52px] flex-1 flex-row items-center justify-center gap-2 rounded-lg bg-primary disabled:opacity-50"
              >
                {saving ? <ActivityIndicator size="small" color="#000" /> : null}
                <Text className="font-bold text-black">Claim & Share</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
