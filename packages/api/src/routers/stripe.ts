import { z } from 'zod';

import { router, protectedProcedure } from '../index';

export const stripeRouter = router({
  createCheckoutSession: protectedProcedure
    .input(z.object({ venueProfileId: z.string().min(1) }))
    .mutation(() => {
      // TODO M8-T1: create Stripe Checkout session and return checkoutUrl
      return { checkoutUrl: '', sessionId: '' };
    }),
});
