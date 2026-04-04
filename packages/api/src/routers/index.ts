import { router } from '../index';

import { adminRouter } from './admin';
import { artistsRouter } from './artists';
import { bookingsRouter } from './bookings';
import { eventsRouter } from './events';
import { sessionsRouter } from './sessions';
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
  sessions: sessionsRouter,
});

export type AppRouter = typeof appRouter;
