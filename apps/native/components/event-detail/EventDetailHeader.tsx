import { AppHeader } from '@/components/AppHeader';

interface EventDetailHeaderProps {
  onBack: () => void;
  /** Event title shown in the bar (replaces the old centered logo). */
  title?: string;
  isSaved: boolean;
  onToggleSave: () => void;
  onShare: () => void;
  className?: string;
}

export function EventDetailHeader({
  onBack,
  title,
  isSaved,
  onToggleSave,
  onShare,
  className,
}: EventDetailHeaderProps) {
  // Standard trailing order: notification bell first, then bookmark, then share.
  return (
    <AppHeader
      leading="back"
      onBack={onBack}
      title={title}
      bgClassName="bg-background"
      className={className}
      showBell
      actions={[
        {
          key: 'save',
          icon: isSaved ? 'bookmark' : 'bookmark-outline',
          onPress: onToggleSave,
          accessibilityLabel: isSaved ? 'Remove from saved' : 'Save event',
        },
        {
          key: 'share',
          icon: 'share-outline',
          onPress: onShare,
          accessibilityLabel: 'Share event',
        },
      ]}
    />
  );
}
