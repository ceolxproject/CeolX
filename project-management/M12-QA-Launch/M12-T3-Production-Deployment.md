# M12-T3 · Production Deployment & Launch Checklist

| Field | Value |
|-------|-------|
| **Milestone** | M12 — QA & Launch |
| **Status** | 🔲 To Do |
| **Depends on** | M12-T1 (QA), M12-T2 (App Store submissions) |
| **PRD Ref** | Section 10.2 (Infrastructure), Section 10.1 (Tech Stack) |

---

## Description
Final production environment setup and go-live. Ensures all services are running in production configuration, environment variables are set correctly, the production database is migrated, and the team has a monitoring baseline before users arrive.

---

## Affected Apps / Packages
| App / Package | Role |
|---------------|------|
| `apps/api` | AWS Lambda production deployment |
| `apps/admin` | Next.js production deployment (Vercel or AWS) |
| `apps/mobile` | App Store / Play Store release (from M12-T2) |

---

## API Endpoints
None — infrastructure/deployment task.

---

## Requirements
- R1: Neon production DB branch created; all Drizzle migrations run cleanly on production
- R2: Hono API deployed to AWS Lambda in production environment with correct environment variables
- R3: `apps/admin` deployed to production (Vercel or chosen hosting) with correct environment variables
- R4: All production env vars set: Neon production connection string, Stripe live keys, Postmark production API key, Firebase production credentials, AWS S3 + CloudFront production config, Mux production credentials
- R5: CloudFront CDN distribution pointing to production S3 bucket
- R6: EAS production channel set to the App Store / Play Store approved builds
- R7: CORS configured for production origins (mobile app + admin dashboard)
- R8: Stripe webhooks configured for production endpoint (`https://api.ceolx.ie/webhooks/stripe`)
- R9: Firebase FCM production app credentials configured
- R10: Super Admin account seeded in production DB via `pnpm seed:admin` — credentials stored securely (not in source)
- R11: Basic error monitoring configured (e.g. Sentry or AWS CloudWatch) before go-live

---

## Acceptance Criteria
- [ ] `GET https://api.ceolx.ie/health` returns `{ status: "ok" }` in production
- [ ] Admin dashboard accessible at `ceolx.ie` (or agreed domain) in production
- [ ] App Store / Play Store builds pointing to production API
- [ ] Stripe live mode webhooks verified (test with a real payment in live mode)
- [ ] Production emails sent from branded address via Postmark live mode
- [ ] Super Admin can log in to production admin dashboard
- [ ] Error monitoring alerts configured and tested

---

## Technical Notes
- Never use the production Neon DB for development — maintain strict environment separation (dev branch / staging branch / prod branch)
- Stripe live keys are separate from test keys — double-check all environments use the correct key set
- Run a final smoke test on the production environment before announcing the launch: sign up, create event, moderate it, subscribe as Venue
- Keep the production deploy script (`turbo deploy` or CI pipeline steps) documented for future deployments
- Launch is timed around the Irish festival season — coordinate go-live date with Chongie Entertainment Services
