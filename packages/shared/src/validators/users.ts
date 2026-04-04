import { z } from 'zod';

export const onboardingSchema = z.object({
  persona: z.enum(['spectator', 'artist', 'venue']),
});

export const switchRoleSchema = z.object({
  role: z.enum(['spectator', 'artist', 'venue']),
});

export const consentSchema = z.object({
  privacyPolicyAccepted: z.literal(true, {
    error: 'You must accept the privacy policy',
  }),
  termsAccepted: z.literal(true, {
    error: 'You must accept the terms of service',
  }),
  marketingOptIn: z.boolean(),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type SwitchRoleInput = z.infer<typeof switchRoleSchema>;
export type ConsentInput = z.infer<typeof consentSchema>;
