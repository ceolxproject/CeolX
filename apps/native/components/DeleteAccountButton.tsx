import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import { Alert, Pressable, Text, View } from 'react-native';

import { appToast } from '@/components/AppToast';
import { useAuth } from '@/contexts/auth-context';
import { clearLocationSetupComplete } from '@/utils/location-setup';
import { trpc } from '@/utils/trpc';

interface DeleteAccountButtonProps {
  /** Called immediately after the deletion request succeeds, before sign-out runs. */
  onDismiss: () => void;
}

/**
 * GDPR M11-T1 — destructive entry inside the Settings bottom sheet.
 *
 * Tapping triggers a native Alert; on confirm we publish a 30-day-delayed
 * `account.anonymize` job, sign the user out and route them to the auth flow.
 * If they sign back in within 30 days the BetterAuth session-create hook
 * cancels the deletion silently and the next users.me fetch fires a toast
 * via the watcher in app/(app)/_layout.tsx.
 */
export function DeleteAccountButton({ onDismiss }: DeleteAccountButtonProps) {
  const { user, logout } = useAuth();
  const requestDeletion = useMutation(trpc.users.requestAccountDeletion.mutationOptions());

  const confirmDelete = async () => {
    // Capture before any await — logout() clears the session mid-flow.
    const userId = user?.id;
    try {
      await requestDeletion.mutateAsync();
      appToast.success('Account scheduled for deletion', 'Sign in within 30 days to cancel.');
      onDismiss();
      await logout();
      // GDPR teardown — drop this account's device-local location-setup flag so a
      // recreated account on this device starts clean. Completion is per-user
      // keyed, so this is hygiene, not correctness; kept OUT of plain logout() on
      // purpose, so a normal logout/login doesn't re-prompt returning users for
      // their location. A keychain clear failure must not mask deletion success.
      if (userId) await clearLocationSetupComplete(userId).catch(() => {});
    } catch {
      appToast.error('Could not delete account', 'Please try again');
    }
  };

  const handlePress = () => {
    Alert.alert(
      'Delete Account',
      'Your account will be anonymised in 30 days. Sign in again before then to cancel.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void confirmDelete();
          },
        },
      ]
    );
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={requestDeletion.isPending}
      className="flex-row items-center justify-between py-3 active:opacity-70"
    >
      <View className="flex-row items-center gap-2">
        <View className="w-8 h-8 rounded-full bg-red-500/20 items-center justify-center">
          <Ionicons name="trash-outline" size={16} color="#ef4444" />
        </View>
        <Text className="text-base text-red-500 font-urbanist">Delete Account</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#8D8D8D" />
    </Pressable>
  );
}
