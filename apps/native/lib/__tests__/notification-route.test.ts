import { describe, expect, it } from 'vitest';

import { resolveNotificationRoute } from '../notification-route';

// The notification inbox navigates with router.push(resolveNotificationRoute(route)).
// `route` is whatever string was persisted on the notification row. Historically
// the trigger registry stored bare paths (/events/:id, /feed, /bookings/:id) that
// do not resolve against this app's group-qualified route tree, sending users to
// +not-found ("Page Not Found"). This resolver maps any stored route — current,
// legacy, or unknown — to a real screen, never a 404. (Asana 1215279003641211)

describe('resolveNotificationRoute', () => {
  it('passes through already-qualified app routes unchanged', () => {
    expect(resolveNotificationRoute('/(app)/(tabs)/bookings/b-1')).toBe(
      '/(app)/(tabs)/bookings/b-1'
    );
    expect(resolveNotificationRoute('/(app)/(tabs)/discover/event/e-1')).toBe(
      '/(app)/(tabs)/discover/event/e-1'
    );
  });

  it('maps legacy bare booking routes to the bookings tab screen', () => {
    expect(resolveNotificationRoute('/bookings/b-123')).toBe('/(app)/(tabs)/bookings/b-123');
  });

  it('maps legacy bare event routes to the discover event detail screen', () => {
    expect(resolveNotificationRoute('/events/e-123')).toBe('/(app)/(tabs)/discover/event/e-123');
  });

  it('remaps the singular shared-link event shape /event/:id to the discover detail', () => {
    expect(resolveNotificationRoute('/event/abc-123')).toBe('/(app)/(tabs)/discover/event/abc-123');
  });

  it('maps bare post routes (the shared-link shape) to the post detail screen', () => {
    // Shared links are https://ceolx.ie/post/:id; the universal-link path is
    // /post/:id, which lands on the (app)/post/[postId] screen (not under tabs).
    expect(resolveNotificationRoute('/post/p-123')).toBe('/(app)/post/p-123');
  });

  it('maps the legacy /feed route to the discover tab', () => {
    expect(resolveNotificationRoute('/feed')).toBe('/(app)/(tabs)/discover');
  });

  it('falls back to discover for unknown or empty routes instead of 404ing', () => {
    expect(resolveNotificationRoute('/totally-unknown/path')).toBe('/(app)/(tabs)/discover');
    expect(resolveNotificationRoute('')).toBe('/(app)/(tabs)/discover');
  });

  it('does not confuse other /events/* sub-routes with the bare detail route', () => {
    // /events/:id/analytics and /events/edit/:id are real (app) screens already —
    // only the bare /events/:id detail route was missing, so only it is remapped.
    expect(resolveNotificationRoute('/(app)/events/e-1/analytics')).toBe(
      '/(app)/events/e-1/analytics'
    );
  });
});
