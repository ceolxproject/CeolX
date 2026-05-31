import { router } from '../../index';

import { resyncEvents } from './maintenance';
import { listEvents, removeEvent, restoreEvent } from './moderation';
import { stats } from './stats';
import { usersRouter } from './users';

export const adminRouter = router({
  stats,
  users: usersRouter,
  listEvents,
  removeEvent,
  restoreEvent,
  resyncEvents,
});
