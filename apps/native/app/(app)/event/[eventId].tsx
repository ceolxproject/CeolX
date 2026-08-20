import { EventDetailScreen } from '@/components/event-detail';

/**
 * Top-level event detail, used when an event is opened from somewhere outside
 * the tabs — a promo post tapped on the post-detail screen, for instance (see
 * components/posts/PostCard).
 *
 * Shared links are minted against this path but no longer land here: they are
 * rewritten to the discover tab in app/+native-intent, so the tab bar is
 * present and back reaches the feed. This route used to do that forwarding
 * itself, which it cannot do safely — see lib/deep-link-routes.
 */
export default function EventDetailRoute() {
  return <EventDetailScreen tabEventRoute="/(app)/events" />;
}
