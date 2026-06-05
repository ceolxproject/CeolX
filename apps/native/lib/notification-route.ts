/**
 * Normalises a persisted notification `route` into a path that resolves against
 * this app's group-qualified Expo Router tree.
 *
 * The notification inbox navigates with `router.push(route)`, where `route` is a
 * string stored on the notification row at creation time. The trigger registry
 * now writes fully-qualified `/(app)/(tabs)/...` paths, but older rows (and any
 * future drift) carry bare paths like `/events/:id` or `/feed` that have no
 * matching screen and land on `+not-found` — the "Page Not Found" bug
 * (Asana 1215279003641211). This resolver remaps the known legacy shapes and
 * funnels anything unrecognised to the discover feed, so a tap is never a 404.
 */
import type { Href } from 'expo-router';

const DISCOVER_ROUTE = '/(app)/(tabs)/discover';

// Typed Routes only know paths we authored at build time; notification routes
// are decided server-side (the trigger registry), so the dynamic branches cast
// through Href and trust the runtime value the resolver guarantees.
export function resolveNotificationRoute(route: string): Href {
  // Already written against the real tree — trust it as-is.
  if (route.startsWith('/(app)')) return route as Href;

  // Legacy bare booking detail: /bookings/:id
  const booking = route.match(/^\/bookings\/([^/]+)$/);
  if (booking) return `/(app)/(tabs)/bookings/${booking[1]}` as Href;

  // Legacy bare event detail: /events/:id → canonical discover event screen.
  const event = route.match(/^\/events\/([^/]+)$/);
  if (event) return `/(app)/(tabs)/discover/event/${event[1]}` as Href;

  // Legacy feed alias and anything unrecognised — never 404, land on discover.
  return DISCOVER_ROUTE;
}
