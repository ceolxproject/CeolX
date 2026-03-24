# Milestone 04 Status Audit (2026-02-26)

## Purpose

Code-evidence sweep for `04-authentication-and-onboarding` to align project-management status with current implementation.

## Source of truth

- Runtime/backend code in `packages/auth`, `packages/api`, `packages/db`, and `apps/api`
- Frontend/mobile implementation in `apps/web-*` and `apps/mobile`
- Verification evidence from existing tests in `packages/auth/src/__tests__`, `packages/api/src/routers/__tests__`, and UI auth component tests

## Task status summary

| Task                                       | Status   | Notes                                                                                                 |
| ------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------- |
| 01 — BetterAuth core setup                 | Complete | Already tracked complete in `PROGRESS.md`; Better Auth wired in API and auth package.                 |
| 02 — Email/password signup                 | Complete | Already tracked complete in `PROGRESS.md`; signup flows implemented across learner/mentor/mobile.     |
| 03 — Email verification                    | Complete | Verification sending and resend flow implemented; verification screens and callback pages present.    |
| 04 — Email/password sign-in                | Complete | Sign-in implemented across learner/mentor/admin/mobile with lockout-aware error handling.             |
| 05 — Google sign-in                        | Partial  | Implemented for learner/mentor/mobile; admin social sign-in not present.                              |
| 06 — Apple sign-in                         | Partial  | Provider and flows implemented, but compliance and full parity requirements remain unverified.        |
| 07 — Forgot password flow                  | Complete | Forgot/reset flows implemented across web/mobile with Better Auth reset email integration.            |
| 09 — Account lockout                       | Complete | Lockout checks/hooks, DB tracking, unlock APIs, and UI handling are implemented.                      |
| 10 — Session management                    | Partial  | Sessions APIs exist; settings UI wiring still TODO in web app.                                        |
| 11 — RBAC roles setup                      | Complete | Roles/permissions schema, middleware, routers, and seed mappings are implemented.                     |
| 12 — Learner onboarding wizard             | Partial  | API + shared wizard components exist; app wiring includes TODOs and cross-app coverage is incomplete. |
| 13 — Instructor application form           | Partial  | API exists; learner UI page is still placeholder/TODO.                                                |
| 14 — Instructor approval flow              | Partial  | Admin APIs exist; admin pages are placeholder/TODO for list/detail actions.                           |
| 15 — Privacy & terms acceptance            | Complete | Consent APIs, policy version checks, and signup consent capture are implemented.                      |
| 16 — Re-verification for sensitive actions | Partial  | Backend reverification flows exist; full end-to-end sensitive-action integration remains incomplete.  |

## Evidence highlights

- Better Auth + providers + lockout hooks: `packages/auth/src/index.ts`
- Apple secret generation: `packages/auth/src/apple-secret.ts`
- API auth routes and Better Auth handler mount: `apps/api/src/app.ts`
- Email verification resend + rate limiting: `packages/api/src/routers/auth.ts`, `packages/api/src/routers/__tests__/auth.test.ts`
- Sessions API: `packages/api/src/routers/sessions.ts`
- RBAC middleware and role routes: `packages/api/src/middleware/rbac.ts`, `packages/api/src/routers/roles.ts`
- Onboarding + consent routers: `packages/api/src/routers/onboarding.ts`, `packages/api/src/routers/consent.ts`
- Instructor workflows: `packages/api/src/routers/instructor-application.ts`, `packages/api/src/routers/instructor-approval.ts`
- Reverification router + middleware: `packages/api/src/routers/reverification.ts`, `packages/api/src/middleware/reverification.ts`
- Known frontend gaps:
  - `apps/web-learner/src/app/(dashboard)/settings/security/page.tsx` (session UI TODO)
  - `apps/web-learner/src/app/(onboarding)/onboarding/page.tsx` (completion wiring TODO)
  - `apps/web-learner/src/app/(dashboard)/become-instructor/page.tsx` (application form wiring TODO)
  - `apps/web-admin/src/app/(dashboard)/instructors/page.tsx` and `apps/web-admin/src/app/(dashboard)/instructors/[id]/page.tsx` (approval UI TODO)
