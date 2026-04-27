import { presignPostImageSchema } from '@CeolX/shared/validators';

import { creatorProcedure } from '../../index';
import { presignPostImageUpload } from '../../services/s3-presigner';

export const presignImage = creatorProcedure
  .input(presignPostImageSchema)
  .mutation(async ({ input, ctx }) => {
    return presignPostImageUpload({
      contentType: input.contentType,
      userId: ctx.userId,
    });
  });
