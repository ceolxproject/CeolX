import { Redirect, useLocalSearchParams } from 'expo-router';
import type { Href } from 'expo-router';

/**
 * Deep-link landing for shared event links (`ceolx.com/event/<id>` /
 * `ceolx://event/<id>`). Events live inside the tab stack, so this thin
 * top-level route immediately forwards to the canonical discover event detail
 * screen — reusing EventDetailScreen with no UI duplication. Mirrors how
 * app/(app)/post/[postId].tsx anchors shared post links.
 */
export default function EventDeepLinkScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();

  if (!eventId) {
    return <Redirect href="/(app)/(tabs)/discover" />;
  }

  return <Redirect href={`/(app)/(tabs)/discover/event/${eventId}` as Href} />;
}
