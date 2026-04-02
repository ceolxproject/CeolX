import { router } from '../index';

import { adminRouter } from './admin';
import { artistsRouter } from './artists';
import { bookingsRouter } from './bookings';
import { eventsRouter } from './events';
import { stripeRouter } from './stripe';
import { usersRouter } from './users';
import { venuesRouter } from './venues';

export const appRouter = router({
  users: usersRouter,
  events: eventsRouter,
  artists: artistsRouter,
  venues: venuesRouter,
  bookings: bookingsRouter,
  stripe: stripeRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
