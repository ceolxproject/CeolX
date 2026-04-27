import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, Text, View } from 'react-native';

type Props = {
  onEdit: () => void;
  onDelete: () => void;
};

/**
 * Owner-only 3-dot menu on a post card.
 *
 * Learning spot (Priya): the delete confirmation currently uses the native
 * Alert.alert dialog. Three viable alternatives, each with a different UX
 * trade-off:
 *
 *   1. Alert.alert (current) — instant, platform-native, blocks interaction
 *      until the user decides. Fine for rare, destructive actions but feels
 *      heavy when users routinely clean up posts.
 *
 *   2. Bottom-sheet confirmation — matches the rest of the app (we use
 *      @gorhom/bottom-sheet for the settings sheet). Dismissable by drag, so
 *      accidental taps are easier to recover from. Slightly higher friction.
 *
 *   3. Optimistic delete + Undo toast — hide the post immediately and show
 *      a Snackbar-style "Post deleted. Undo" for ~5s. If the user taps Undo,
 *      restore client-side + abort the mutation. Best "power user" UX; but
 *      leaks a window where the post appears deleted to the owner before
 *      the backend has persisted the soft-delete — not ideal for content
 *      safety.
 *
 * Pick one and replace the `confirmDelete` body below. The hook and server
 * side are ready for any of these patterns.
 *
 * TODO(priya): replace Alert.alert with the chosen confirmation flow.
 */
export function PostActionMenu({ onEdit, onDelete }: Props) {
  const [open, setOpen] = useState(false);

  const confirmDelete = useCallback(() => {
    setOpen(false);
    Alert.alert('Delete post?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  }, [onDelete]);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        className="h-7 w-7 items-center justify-center rounded-full bg-[#C8FF2F]"
        hitSlop={8}
      >
        <Ionicons name="ellipsis-horizontal" size={16} color="#080808" />
      </Pressable>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1" onPress={() => setOpen(false)}>
          <View className="absolute right-4 top-20 rounded-lg bg-[#F5F1FF] px-4 py-3 shadow">
            <Pressable
              className="py-2"
              onPress={() => {
                setOpen(false);
                onEdit();
              }}
            >
              <Text className="text-sm font-medium text-black font-urbanist">Edit</Text>
            </Pressable>
            <Pressable className="py-2" onPress={confirmDelete}>
              <Text className="text-sm font-medium text-black font-urbanist">Delete</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
