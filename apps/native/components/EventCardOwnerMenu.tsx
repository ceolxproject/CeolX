import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Modal, Pressable, Text, TouchableWithoutFeedback, View } from 'react-native';

export interface EventCardOwnerActions {
  onEdit: () => void;
  onAnalytics: () => void;
  onArchive: () => void;
}

interface EventCardOwnerMenuProps {
  actions: EventCardOwnerActions;
}

// Kebab (3-dot) overlay used on My Events cards. Opens a small popover anchored
// to the top-right of the card cover image with Edit / Analytics / Delete.
// Delete shows a confirmation Alert that mirrors the existing OwnerActionBar copy.
export function EventCardOwnerMenu({ actions }: EventCardOwnerMenuProps) {
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  const handleEdit = () => {
    close();
    actions.onEdit();
  };

  const handleAnalytics = () => {
    close();
    actions.onAnalytics();
  };

  const handleArchive = () => {
    close();
    Alert.alert(
      'Archive Event',
      'This will remove the event from the map and feed. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Archive', style: 'destructive', onPress: actions.onArchive },
      ]
    );
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Manage event"
        hitSlop={8}
        className="h-8 w-8 items-center justify-center rounded-full bg-green-10 active:opacity-80"
      >
        <Ionicons name="ellipsis-horizontal" size={16} color="#080808" />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={close}
        statusBarTranslucent
      >
        <TouchableWithoutFeedback onPress={close}>
          <View className="flex-1 bg-black/40 items-end pt-[280px] pr-5">
            <TouchableWithoutFeedback>
              <View className="rounded-2xl bg-white py-1 min-w-[160px] shadow-2xl">
                <MenuItem
                  label="Edit"
                  icon="create-outline"
                  onPress={handleEdit}
                  testID="event-card-owner-menu-edit"
                />
                <MenuItem
                  label="Analytics"
                  icon="stats-chart-outline"
                  onPress={handleAnalytics}
                  testID="event-card-owner-menu-analytics"
                />
                <MenuItem
                  label="Delete"
                  icon="trash-outline"
                  destructive
                  onPress={handleArchive}
                  testID="event-card-owner-menu-delete"
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

interface MenuItemProps {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  destructive?: boolean;
  testID?: string;
}

function MenuItem({ label, icon, onPress, destructive, testID }: MenuItemProps) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      className="flex-row items-center px-4 py-3 active:bg-black/5"
    >
      <Ionicons
        name={icon}
        size={16}
        color={destructive ? '#dc2626' : '#080808'}
        style={{ marginRight: 10 }}
      />
      <Text
        className="text-sm font-semibold font-urbanist"
        style={{ color: destructive ? '#dc2626' : '#080808' }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
