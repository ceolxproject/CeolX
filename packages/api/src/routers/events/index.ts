import { router } from '../../index';

import { archive, byId, create, getMyEvents, update } from './crud';
import { getFeed } from './feed';
import { getMap } from './map';
import { getPresignedUrl, getSavedEvents, save, unsave } from './saved';

export const eventsRouter = router({
  getMap,
  getFeed,
  byId,
  create,
  update,
  archive,
  save,
  unsave,
  getMyEvents,
  getSavedEvents,
  getPresignedUrl,
});
