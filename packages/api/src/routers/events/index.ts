import { router } from '../../index';

import { byId, create, update } from './crud';
import { getFeed } from './feed';
import { getMap } from './map';
import { getPresignedUrl, save, unsave } from './saved';

export const eventsRouter = router({
  getMap,
  getFeed,
  byId,
  create,
  update,
  save,
  unsave,
  getPresignedUrl,
});
