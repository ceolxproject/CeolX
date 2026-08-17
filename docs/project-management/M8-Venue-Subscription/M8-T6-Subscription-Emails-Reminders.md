# M8-T6 · Subscription Emails & Reminders

| Field          | Value                                                                                                 |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| **Milestone**  | M8 — Venue Subscription & Payments                                                                    |
| **Status**     | 🔲 To Do                                                                                              |
| **Decisions**  | `M8-T0-Subscription-Decisions.md` — **read first.** This task implements D-18, D-26, D-30, D-38, D-45 |
| **Depends on** | M8-T1 (token issuance), M8-T3 (trial end date persisted)                                              |
| **Unblocks**   | M7-T4 PR3, which has been parked on M8                                                                |

---

## Description

Every email CeolX sends about a subscription, and the scheduling behind them. Deliberately short — most billing email stays Stripe's (D-38).

---

## Affected apps / packages

| App / package    | Role                                              |
| ---------------- | ------------------------------------------------- |
| `packages/email` | Templates + senders                               |
| `apps/server`    | Job handlers and scheduling via QStash            |
| `packages/api`   | Enqueues on activation request and portal request |

---

## Scope

### 1 · Emails we send

| Email                | Trigger                                   | Status                                                                                                                               |
| -------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Venue activation     | Venue taps **Activate Profile**           | **Exists** — `templates/venue-activation.tsx`. Needs the newest-link wording (D-18) and the token URL                                |
| Activation reminder  | 24 h, 3 days, 7 days after sign-up (D-26) | New — one template, three sends                                                                                                      |
| Trial ending         | 7 days before the first charge (D-30)     | New. States the amount and the date                                                                                                  |
| Payment confirmation | First successful charge                   | **Exists** — `templates/payment-confirmation.tsx`. Verify the amount is not hardcoded; the old M8-T1 doc quoted €29.99 / "CeolX Pro" |
| Manage subscription  | Venue taps **Manage Subscription** (D-45) | New. Carries a freshly created Portal link                                                                                           |

### 2 · Emails we do not send

Per D-38, failed payments, card-expiry warnings and 3-D Secure approval requests stay **Stripe's**. Do not add templates for them. Duplicating billing email means two sources of truth about money, in the venue's inbox, disagreeing.

### 3 · Activation reminders

`apps/server/src/jobs/publish.ts` already accepts `delay` as a duration string (`"24h"`, `"3d"`, `"7d"`), so this needs no new infrastructure — three delayed jobs queued when the first activation email goes out.

Each job **re-checks status before sending** and no-ops unless still `inactive`. A venue who activated an hour later must not receive three nudges. Requeue on a fresh activation request, and make sure a venue who requests five links does not accumulate fifteen reminders — key the reminders to the account, not to the token.

### 4 · Trial-ending email

Scheduled from the persisted `trial_ends_at` (M8-T3) minus 7 days, not from Stripe's `trial_will_end` event, which fires ~3 days out. M8-T3 treats that event as a safety net.

Re-check before sending: skip if the venue already cancelled, or if the trial end date moved.

This email matters disproportionately. A charge landing six months after sign-up, unannounced, is how chargebacks happen — and D-51 makes a chargeback expensive for the venue.

### 5 · Existing wiring

Templates dispatch through the `email.send` QStash job — the `EMAIL_TEMPLATES` list in `apps/server/src/jobs/types.ts` and the map in `jobs/handlers/email.ts`. New templates must be added to both, plus `packages/email/src/registry.ts` and `types.ts`. The existing tests in `packages/email/src/__tests__/` cover subjects, senders and templates; extend them rather than adding a parallel suite.

### 6 · Deliverability

Sean's activation email is the **only** route into the paid flow (D-16), so a bounce means a venue that can never subscribe. The Postmark bounce webhook is already live at `POST /api/webhooks/postmark` and logs events. For subscription emails specifically, a hard bounce needs to be visible to someone — a venue silently stuck at `inactive` because their address bounced looks identical to a venue that simply never got round to it.

---

## Acceptance criteria

- [ ] Activation email carries the tokenised URL and states that it supersedes any earlier link (D-18)
- [ ] Reminders fire at 24 h, 3 days and 7 days
- [ ] Each reminder no-ops if the venue is no longer `inactive`
- [ ] Requesting several activation links does not multiply reminders
- [ ] Trial-ending email fires 7 days before the first charge with the correct amount and date
- [ ] Trial-ending email is skipped for a venue that cancelled during the trial
- [ ] Payment confirmation shows the real amount and plan — nothing hardcoded
- [ ] Manage-subscription email carries a freshly created Portal link
- [ ] No template exists for payment failure, card expiry or 3-D Secure (D-38)
- [ ] New templates registered in `registry.ts`, `types.ts`, `jobs/types.ts` and `handlers/email.ts`
- [ ] Existing email tests extended, not duplicated
- [ ] Hard bounce on a subscription email is observable

---

## Dependencies

- **Upstream**: M8-T1, M8-T3, M1-T6 (Postmark), M1-T13 (QStash)
- **Downstream**: M7-T4 PR3 (subscription lifecycle emails) is unblocked by this task
- **External**: Postmark, QStash

---

## Notes

Copy for every new template comes from the client (D-46). The amount and date in the trial-ending email must be read from Stripe at send time, not stored at sign-up — six months is long enough for pricing to change.
