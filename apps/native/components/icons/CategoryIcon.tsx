import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

type GlyphName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/**
 * Maps an event category (key from EVENT_CATEGORIES) to a MaterialCommunityIcons
 * glyph. Replaces the old emoji set so categories render as consistent vector
 * icons across iOS and Android. Keep this the single source of truth for
 * category iconography — render everywhere via <CategoryIcon />.
 */
const CATEGORY_ICON_NAMES: Record<string, GlyphName> = {
  Concerts: 'microphone-variant',
  Gigs: 'guitar-electric',
  Karaoke: 'music',
  'Open Mic Nights': 'microphone',
  Festivals: 'tent',
  Recital: 'violin',
  'DJ Sets / Club Nights': 'headphones',
  'Jam Sessions': 'guitar-acoustic',
  'Tribute / Cover Band Shows': 'account-music',
  Workshops: 'hammer-wrench',
  'Open Trad Sessions': 'clover',
  Lessons: 'school',
  Outdoor: 'pine-tree',
  Others: 'dots-horizontal',
};

const FALLBACK: GlyphName = 'music-note';

export function CategoryIcon({
  category,
  size = 12,
  color = '#000',
}: {
  category: string;
  size?: number;
  color?: string;
}) {
  return (
    <MaterialCommunityIcons
      name={CATEGORY_ICON_NAMES[category] ?? FALLBACK}
      size={size}
      color={color}
    />
  );
}
