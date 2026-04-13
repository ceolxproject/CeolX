import { router } from '../index';

import { adminRouter } from './admin';
import { artistsRouter } from './artists';
import { bookingsRouter } from './bookings';
import { collectionsRouter } from './collections';
import { eventsRouter } from './events';
import { onboardingRouter } from './onboarding';
import { stripeRouter } from './stripe';
import { usersRouter } from './users';
import { venuesRouter } from './venues';

export const appRouter = router({
  users: usersRouter,
  onboarding: onboardingRouter,
  events: eventsRouter,
  artists: artistsRouter,
  venues: venuesRouter,
  bookings: bookingsRouter,
  collections: collectionsRouter,
  stripe: stripeRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
