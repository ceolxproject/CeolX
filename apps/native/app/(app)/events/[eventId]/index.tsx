import { EventDetailScreen } from '@/components/event-detail';

// Top-level event detail (sibling of (tabs)), used when an event is opened from
// a screen that lives above the tab navigator — e.g. the public artist/venue
// profile pages. Pushing here keeps the detail on the (app) stack so Back
// returns to the profile, then to wherever the profile was opened from, instead
// of diving into a tab's stack.
export default function EventDetailRoute() {
  return <EventDetailScreen tabEventRoute="/(app)/events" />;
}
