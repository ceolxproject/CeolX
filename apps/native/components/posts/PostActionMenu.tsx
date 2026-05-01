import { AnchoredMenu, type AnchoredMenuItem } from '../AnchoredMenu';

type Props = {
  onEdit: () => void;
  onDelete: () => void;
};

export function PostActionMenu({ onEdit, onDelete }: Props) {
  const items: AnchoredMenuItem[] = [
    { label: 'Edit', icon: 'create-outline', onPress: onEdit },
    {
      label: 'Delete',
      icon: 'trash-outline',
      destructive: true,
      onPress: onDelete,
      confirm: {
        title: 'Delete post?',
        message: 'This action cannot be undone.',
        confirmLabel: 'Delete',
      },
    },
  ];

  return <AnchoredMenu items={items} triggerSize={28} accessibilityLabel="Post options" />;
}
