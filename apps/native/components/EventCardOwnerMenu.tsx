import { AnchoredMenu, type AnchoredMenuItem } from './AnchoredMenu';

export interface EventCardOwnerActions {
  onEdit: () => void;
  onAnalytics: () => void;
  onArchive: () => void;
}

interface EventCardOwnerMenuProps {
  actions: EventCardOwnerActions;
  /**
   * Only ACTIVE events can be deleted (the server archives them). Hide the
   * option for draft/pending/removed events so we never fire a delete the
   * backend will reject. Defaults to true.
   */
  canDelete?: boolean;
}

export function EventCardOwnerMenu({ actions, canDelete = true }: EventCardOwnerMenuProps) {
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
  ];

  if (canDelete) {
    items.push({
      label: 'Delete',
      icon: 'trash-outline',
      destructive: true,
      onPress: actions.onArchive,
      testID: 'event-card-owner-menu-delete',
      confirm: {
        title: 'Delete Event',
        message: 'This will remove the event from the map and feed. This action cannot be undone.',
        confirmLabel: 'Delete',
      },
    });
  }

  return <AnchoredMenu items={items} accessibilityLabel="Manage event" />;
}
