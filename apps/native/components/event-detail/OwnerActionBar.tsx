import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { Alert, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EventStatus } from '@CeolX/shared/enums';

interface OwnerActionBarProps {
  eventStatus: string;
  onEdit: () => void;
  onArchive: () => void;
  className?: string;
}

export function OwnerActionBar({ eventStatus, onEdit, onArchive, className }: OwnerActionBarProps) {
  const insets = useSafeAreaInsets();

  if (eventStatus === EventStatus.ARCHIVED) return null;

  const isRemoved = eventStatus === EventStatus.REMOVED;

  const handleArchive = () => {
    Alert.alert(
      'Delete Event',
      'This will remove the event from the map and feed. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onArchive },
      ]
    );
  };

  return (
    <View
      className={cn('px-4 pt-2.5 bg-black', className)}
      // Pad the bottom past the Android system nav bar / iOS home indicator so
      // Edit/Archive aren't overlapped by the back/home/recents buttons. Falls
      // back to the original 10px spacing on devices with no bottom inset.
      style={{
        paddingBottom: insets.bottom + 10,
        shadowColor: 'rgba(239,239,244,0.25)',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 1,
        shadowRadius: 12,
        elevation: 12,
      }}
    >
      <View className="flex-row items-center gap-2">
        {/* Edit / Resubmit */}
        <Pressable
          onPress={onEdit}
          className="flex-1 flex-row items-center justify-center rounded-full h-11 bg-green-10 active:opacity-90"
        >
          <Ionicons name="create-outline" size={16} color="#000" style={{ marginRight: 6 }} />
          <Text className="text-xs font-bold text-black tracking-widest uppercase font-urbanist">
            {isRemoved ? 'Edit & Resubmit' : 'Edit Event'}
          </Text>
        </Pressable>

        {/* Delete — only for active events (server soft-archives them) */}
        {!isRemoved && (
          <Pressable
            onPress={handleArchive}
            className="flex-1 flex-row items-center justify-center rounded-full h-11 border border-red-400 active:opacity-80"
          >
            <Ionicons name="trash-outline" size={16} color="#f87171" style={{ marginRight: 6 }} />
            <Text className="text-xs font-bold text-red-400 tracking-wider uppercase font-urbanist">
              Delete
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
