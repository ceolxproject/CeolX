import { AnchoredMenu, type AnchoredMenuItem } from './AnchoredMenu';

export interface EventCardOwnerActions {
  onEdit: () => void;
  onAnalytics: () => void;
  onArchive: () => void;
}

interface EventCardOwnerMenuProps {
  actions: EventCardOwnerActions;
}

export function EventCardOwnerMenu({ actions }: EventCardOwnerMenuProps) {
  const items: AnchoredMenuItem[] = [
    {
      label: 'Edit',
      icon: 'create-outline',
      onPress: actions.onEdit,
      testID: 'event-card-owner-menu-edit',
    },
    {
      label: 'Analytics',
      icon: 'stats-chart-outline',
      onPress: actions.onAnalytics,
      testID: 'event-card-owner-menu-analytics',
    },
    {
      label: 'Delete',
      icon: 'trash-outline',
      destructive: true,
      onPress: actions.onArchive,
      testID: 'event-card-owner-menu-delete',
      confirm: {
        title: 'Archive Event',
        message: 'This will remove the event from the map and feed. This action cannot be undone.',
        confirmLabel: 'Archive',
      },
    },
  ];

  return <AnchoredMenu items={items} accessibilityLabel="Manage event" />;
}
