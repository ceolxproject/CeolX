# DS-T6 · Zod Validators Package (`packages/shared`)

| Field          | Value                                                                |
| -------------- | -------------------------------------------------------------------- |
| **Milestone**  | M1.6 — Design System & Shared Packages                               |
| **Status**     | 🔲 To Do                                                             |
| **Depends on** | M1-T10 (packages/shared scaffold), M1.5 (DB schema enums defined)    |
| **PRD Ref**    | Section 4 (Auth), Section 6 (Events), Section 10.1 (packages/shared) |

---

## Description

Create Zod validation schemas for all API request/response shapes in `packages/shared/src/validators/`. Schemas serve dual purpose: frontend form validation (mobile + admin) and backend API request validation (Hono + `@hono/zod-validator`). Defining schemas once in the shared package ensures the mobile app, admin dashboard, and API server all validate using identical rules — no drift between client and server validation.

---

## Affected Apps / Packages

| App / Package     | Role                                                        |
| ----------------- | ----------------------------------------------------------- |
| `packages/shared` | Exports all Zod schemas and inferred TypeScript types       |
| `apps/api`        | Uses schemas in `zValidator('json', schema)` on Hono routes |
| `apps/native`     | Uses schemas for form validation before API calls           |
| `apps/admin`      | Uses schemas for admin form validation                      |

---

## Requirements

### Auth Validators

```typescript
signUpSchema; // name, email, password, confirmPassword
signInSchema; // email, password
forgotPasswordSchema; // email
resetPasswordSchema; // token, newPassword, confirmPassword
verifyEmailSchema; // token
```

### User / Onboarding Validators

```typescript
onboardingSchema; // persona: 'spectator' | 'artist' | 'venue'
switchRoleSchema; // role: 'spectator' | 'artist' | 'venue'
consentSchema; // privacyPolicyAccepted: true, termsAccepted: true, marketingOptIn: boolean
```

### Artist Profile Validators

```typescript
artistProfileSchema; // stageName, bio, genre, profileImageUrl
```

### Venue Profile Validators

```typescript
venueProfileSchema; // venueName, address, bio, profileImageUrl
```

### Event Validators

```typescript
createEventSchema; // title, description, coverImage, dateStart, dateEnd?, lat, lng,
// venueId | venueAddress, category, ticketLink?, isGigOpportunity
updateEventSchema; // Partial<createEventSchema>
rejectEventSchema; // rejectionReason (min 10 chars)
```

### Shared Validation Rules

- Email: RFC 5322, lowercase transform
- Password: min 8 chars, uppercase, lowercase, number, special character (`!@#$%^&*`)
- Irish phone (optional field): regex for +353 format
- Latitude: -90 to 90
- Longitude: -180 to 180
- URLs: valid URL format for `ticketLink`
- Text fields: trim whitespace, max length constraints

---

## Acceptance Criteria

- [ ] All schemas exported from `packages/shared/src/validators/index.ts`
- [ ] `signUpSchema` rejects password without uppercase, number, or special char
- [ ] `signUpSchema` rejects mismatched `confirmPassword`
- [ ] `createEventSchema` rejects invalid lat/lng values
- [ ] `rejectEventSchema` rejects reason shorter than 10 characters
- [ ] `consentSchema` rejects if `privacyPolicyAccepted` is `false`
- [ ] All schemas export inferred TypeScript types (e.g. `type SignUpInput = z.infer<typeof signUpSchema>`)
- [ ] Hono route using `zValidator('json', signUpSchema)` returns `400` for invalid input
- [ ] Mobile form using `signUpSchema.safeParse(values)` shows field-level errors

---

## Dependencies

### Upstream

- M1-T10 (packages/shared scaffold — validators live here)
- M1.5 (DB enums — `EventCategory`, `UserRole` used in schemas)

### Downstream

- M2-T1 (sign-up/sign-in forms use auth validators)
- M2-T7 (consent form uses consentSchema)
- M4 (event creation form uses createEventSchema)
- All Hono routes use shared validators via `@hono/zod-validator`

---

## Technical Notes

### Auth Validators

```typescript
// packages/shared/src/validators/auth.ts

import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'Minimum 8 characters')
  .regex(/[A-Z]/, 'Must include an uppercase letter')
  .regex(/[a-z]/, 'Must include a lowercase letter')
  .regex(/[0-9]/, 'Must include a number')
  .regex(/[!@#$%^&*]/, 'Must include a special character (!@#$%^&*)');

export const signUpSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(100),
    email: z.string().email('Invalid email').toLowerCase(),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const signInSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().toLowerCase(),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().uuid(),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
```

### Event Validators

```typescript
// packages/shared/src/validators/events.ts

import { z } from 'zod';
import { EVENT_CATEGORIES } from '../enums';

export const createEventSchema = z
  .object({
    title: z.string().min(3).max(120).trim(),
    description: z.string().min(10).max(2000).trim(),
    coverImage: z.string().url().optional(),
    dateStart: z.string().datetime(),
    dateEnd: z.string().datetime().optional(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    venueId: z.string().uuid().optional(),
    venueAddress: z.string().max(200).optional(),
    category: z.enum(EVENT_CATEGORIES),
    ticketLink: z.string().url().optional(),
    isGigOpportunity: z.boolean().default(false),
  })
  .refine((data) => data.venueId || data.venueAddress, {
    message: 'Either venueId or venueAddress is required',
    path: ['venueId'],
  });

export const rejectEventSchema = z.object({
  rejectionReason: z.string().min(10, 'Rejection reason must be at least 10 characters').max(500),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type RejectEventInput = z.infer<typeof rejectEventSchema>;
```

### Barrel Export

```typescript
// packages/shared/src/validators/index.ts
export * from './auth';
export * from './events';
export * from './users';
export * from './profiles';
```

---

## Common Gotchas

- **`.toLowerCase()` transform on email**: Zod's `.toLowerCase()` is a transform — it modifies the parsed value. Ensure backend always stores the transformed (lowercase) value.
- **`z.literal(true)` for consent**: Use `z.literal(true)` not `z.boolean()` for mandatory consent fields — it makes `false` a validation error, not just a value.
- **`safeParse` vs `parse`**: Use `safeParse` on the frontend (returns `{ success, error }` without throwing). Use `parse` or `zValidator` on the backend where errors should propagate.
- **Shared schemas must be framework-agnostic**: No React, React Native, or Hono imports in `packages/shared/validators/`. Pure Zod only.

---
