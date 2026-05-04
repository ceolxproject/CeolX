import { router } from '../../index';

import { byId, byUser, create, remove, update } from './crud';
import { feed } from './feed';
import { toggleLike } from './interactions';

// presignImage was retired in M10-T1 — clients call uploads.presignUpload
// directly with `{ type: 'post_image', contentType }` instead.
export const postsRouter = router({
  create,
  update,
  delete: remove,
  byId,
  byUser,
  feed,
  toggleLike,
});
