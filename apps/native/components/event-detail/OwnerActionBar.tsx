import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { Alert, Pressable, Text, View } from 'react-native';

interface OwnerActionBarProps {
  eventStatus: string;
  onEdit: () => void;
  onArchive: () => void;
  className?: string;
}

export function OwnerActionBar({ eventStatus, onEdit, onArchive, className }: OwnerActionBarProps) {
  if (eventStatus === 'archived') return null;

  const isRemoved = eventStatus === 'removed';

  const handleArchive = () => {
    Alert.alert(
      'Archive Event',
      'This will remove the event from the map and feed. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Archive', style: 'destructive', onPress: onArchive },
      ]
    );
  };

  return (
    <View
      className={cn('px-4 py-2.5 bg-black', className)}
      style={{
        shadowColor: 'rgba(239,239,244,0.25)',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 1,
        shadowRadius: 12,
        elevation: 12,
      }}
    >
      <View className="flex-row items-center gap-2.5">
        {/* Edit / Resubmit */}
        <Pressable
          onPress={onEdit}
          className={cn(
            'flex-row items-center justify-center rounded-full py-3 px-8 bg-green-10 active:opacity-90',
            isRemoved ? 'flex-1' : 'flex-1'
          )}
        >
          <Ionicons name="create-outline" size={18} color="#000" style={{ marginRight: 6 }} />
          <Text className="text-base font-bold text-black tracking-wider uppercase font-sans">
            {isRemoved ? 'Edit & Resubmit' : 'Edit Event'}
          </Text>
        </Pressable>

        {/* Archive — only for active events */}
        {!isRemoved && (
          <Pressable
            onPress={handleArchive}
            className="flex-row items-center justify-center rounded-full py-3 px-6 border border-red-400 active:opacity-80"
          >
            <Ionicons name="archive-outline" size={18} color="#f87171" style={{ marginRight: 6 }} />
            <Text className="text-base font-bold text-red-400 font-sans">Archive</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
