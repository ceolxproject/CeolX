import { router } from '../index';

import { adminRouter } from './admin';
import { artistsRouter } from './artists';
import { bookingsRouter } from './bookings';
import { collaborationRouter } from './collaboration';
import { collectionsRouter } from './collections';
import { deviceTokensRouter } from './device-tokens';
import { discoveryRouter } from './discovery';
import { eventsRouter } from './events';
import { followsRouter } from './follows';
import { notificationsRouter } from './notifications';
import { onboardingRouter } from './onboarding';
import { postsRouter } from './posts';
import { profilesRouter } from './profiles';
import { uploadsRouter } from './uploads';
import { usersRouter } from './users';
import { venuesRouter } from './venues';

export const appRouter = router({
  users: usersRouter,
  onboarding: onboardingRouter,
  events: eventsRouter,
  artists: artistsRouter,
  venues: venuesRouter,
  profiles: profilesRouter,
  bookings: bookingsRouter,
  collaboration: collaborationRouter,
  collections: collectionsRouter,
  follows: followsRouter,
  notifications: notificationsRouter,
  deviceTokens: deviceTokensRouter,
  discovery: discoveryRouter,
  posts: postsRouter,
  uploads: uploadsRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
