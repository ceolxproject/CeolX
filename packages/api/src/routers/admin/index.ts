import { router } from '../../index';

import { approveEvent, pendingEvents, rejectEvent } from './pending';
import { stats } from './stats';
import { usersRouter } from './users';

export const adminRouter = router({
  stats,
  users: usersRouter,
  pendingEvents,
  approveEvent,
  rejectEvent,
});
