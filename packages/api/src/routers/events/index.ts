import { router } from '../../index';

import { analytics, trackTicketClick } from './analytics';
import { archive, byId, create, getMyEvents, update } from './crud';
import { getFeed } from './feed';
import { feedAds } from './feed-ads';
import { getMap } from './map';
import { getPresignedUrl, getSavedEvents, save, unsave } from './saved';

export const eventsRouter = router({
  getMap,
  getFeed,
  feedAds,
  byId,
  create,
  update,
  archive,
  save,
  unsave,
  getMyEvents,
  getSavedEvents,
  getPresignedUrl,
  analytics,
  trackTicketClick,
});
