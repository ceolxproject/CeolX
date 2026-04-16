/**
 * Mock images for demo purposes — remove when M10 (media upload) ships.
 *
 * Profile: single headshot used for all avatar fallbacks.
 * Events:  two Irish music photos, rotated deterministically by string hash.
 */
import type { ImageSourcePropType } from 'react-native';

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
export const MOCK_PROFILE_IMAGE: ImageSourcePropType = require('@/assets/images/mock-profile.jpg');

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const MOCK_EVENT_IMAGES: ImageSourcePropType[] = [
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@/assets/images/mock-event-1.png'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@/assets/images/mock-event-2.png'),
];

/** Pick a mock event image deterministically from an ID or index. */
export function getMockEventImage(key: string | number): ImageSourcePropType {
  if (typeof key === 'number') return MOCK_EVENT_IMAGES[key % 2];
  // Simple char-code hash so the same event always gets the same image
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash += key.charCodeAt(i);
  return MOCK_EVENT_IMAGES[hash % 2];
}
