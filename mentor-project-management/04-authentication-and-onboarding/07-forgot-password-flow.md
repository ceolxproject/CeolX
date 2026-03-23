# Forgot Password Flow

## Description

Password reset is implemented using Better Auth's email/password reset flow.
Users submit an email, receive a password reset link via email, and set a new password from the reset screen.

This project currently uses a link-based reset flow (no OTP/manual code entry flow).

## Affected Apps/Packages

- `packages/auth`
- `packages/email`
- `packages/ui`
- `apps/api`
- Frontend: `apps/web-learner`, `apps/web-mentor`, `apps/web-admin`, `apps/mobile`

## Implemented Flow

### 1. Request Password Reset

Frontend calls Better Auth client:

- `authClient.requestPasswordReset({ email, redirectTo: "/reset-password" })`

Behavior:

- Email input validated in shared validators (`resetPasswordSchema`)
- UI shows success message without revealing account existence
- If account exists, Better Auth invokes `emailAndPassword.sendResetPassword`

### 2. Send Reset Email

`packages/auth` wires Better Auth reset email handler:

- `emailAndPassword.sendResetPassword` sends template `password-reset`
- Email includes reset URL (`resetUrl`)
- Localized email rendering handled by `@mentor/email`

### 3. Reset Password

Frontend reset page reads `token` from URL and calls:

- `authClient.resetPassword({ token, newPassword })`

Behavior:

- New password + confirm password validated in shared validators (`resetPasswordWithTokenSchema`)
- Password strength indicator shown in web/mobile reset forms
- On success, user is redirected to sign in

## API Surface (Current Stack)

This project uses Better Auth auth routes mounted at:

- `/api/auth/*`

No custom Hono endpoints (`POST /auth/forgot-password`, `POST /auth/reset-password`) are implemented for this flow.

## Rate Limiting (Current)

Rate limiting is applied at API middleware level:

- `/api/auth/*` uses `RATE_LIMIT_TIERS.authLogin`
- Current value: `10` requests per `15m` per IP

This is a generic auth limiter, not a dedicated per-email forgot-password limiter.

## Acceptance Criteria (Updated to Match Implementation)

- [x] Forgot password screens exist for learner, mentor, admin web apps, and mobile
- [x] Reset password screens exist for learner, mentor, admin web apps, and mobile
- [x] Email input is validated client-side with shared schema
- [x] Request flow uses Better Auth `requestPasswordReset`
- [x] Reset flow uses Better Auth `resetPassword`
- [x] Password reset email template is implemented and tested
- [x] Reset link token is consumed from URL params on reset page
- [x] Password strength indicator is shown in reset form (web and mobile)
- [x] Generic auth route rate limiting is enabled on `/api/auth/*`
- [x] Success/error UI states are implemented for request and reset forms

## Out of Scope (Not Implemented in Current Flow)

- OTP/manual code password reset fallback
- Dedicated forgot-password rate limits (per-email 3/30m plus per-IP 10/1h)
- Custom cleanup cron for reset tokens (managed by Better Auth internals)
- Custom reset-token table/handler implementation in Hono

## Dependencies

- Better Auth
- `@mentor/email` (password reset template rendering)
- `@mentor/validators` (email/password validation)
- Upstash rate limiter middleware via `@mentor/cache`

## Verification Notes (2026-02-26)

### Code evidence

- `packages/auth/src/index.ts` (`emailAndPassword.sendResetPassword`)
- `packages/auth/src/client.ts`
- `apps/api/src/app.ts` (auth route mounting and rate limiter)
- `packages/cache/src/rate-limit.ts` (`RATE_LIMIT_TIERS.authLogin`)
- `packages/email/src/templates/password-reset.tsx`
- `packages/email/src/__tests__/render.test.ts`
- `packages/ui/src/components/forgot-password-form.tsx`
- `packages/ui/src/components/reset-password-form.tsx`
- `apps/web-learner/src/app/(auth)/forgot-password/page.tsx`
- `apps/web-learner/src/app/(auth)/reset-password/page.tsx`
- `apps/web-mentor/src/app/(auth)/forgot-password/page.tsx`
- `apps/web-mentor/src/app/(auth)/reset-password/page.tsx`
- `apps/web-admin/src/app/(auth)/forgot-password/page.tsx`
- `apps/web-admin/src/app/(auth)/reset-password/page.tsx`
- `apps/mobile/app/(auth)/forgot-password.tsx`
- `apps/mobile/app/(auth)/reset-password.tsx`
