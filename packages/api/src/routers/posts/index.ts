import { router } from '../../index';

import { byId, byUser, create, remove, update } from './crud';
import { feed } from './feed';
import { toggleLike } from './interactions';
import { presignImage } from './upload';

export const postsRouter = router({
  create,
  update,
  delete: remove,
  byId,
  byUser,
  feed,
  toggleLike,
  presignImage,
});
