import { router } from '../../index';

import { listEvents, removeEvent } from './moderation';
import { stats } from './stats';
import { usersRouter } from './users';

export const adminRouter = router({
  stats,
  users: usersRouter,
  listEvents,
  removeEvent,
});
