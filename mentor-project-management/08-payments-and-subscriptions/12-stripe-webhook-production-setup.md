# Task 12: Stripe Webhook Production Setup

## Description

Register the Stripe webhook endpoint in the Stripe Dashboard for staging and production environments. This is a manual operational task to be completed when the API is deployed to a publicly accessible URL.

## Prerequisites

- Task 01 (Stripe Billing Setup) complete
- API deployed to staging or production with a public HTTPS URL
- Admin access to Stripe Dashboard

## Steps

1. Go to **Stripe Dashboard → Developers → Webhooks → Add destination**

2. Fill in:
   - **Endpoint URL**: `https://your-api-domain.com/api/webhooks/stripe`
   - **Events to listen**:
     - `checkout.session.completed`
     - `invoice.paid`
     - `invoice.payment_failed`
     - `invoice.upcoming`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `charge.refunded`

3. Click **Add destination** → on the endpoint detail page → **Reveal** signing secret → copy `whsec_...`

4. Update `STRIPE_WEBHOOK_SECRET` in the production/staging environment with the new secret

5. Update `WEBHOOK_ENDPOINT` env var to the full public URL

## Notes

- Do **not** reuse the local Stripe CLI webhook secret (`whsec_...` from `stripe listen`) — each registered endpoint gets its own secret
- Repeat these steps separately for staging and production (each gets its own endpoint + secret)
- For local development, use the Stripe CLI listener instead (see Task 01)

## Verification

Send a test event from the Dashboard:
**Developers → Webhooks → select your endpoint → Send test event → `checkout.session.completed`**

Confirm the API logs show:

```
[stripe webhook] received event: evt_xxx (checkout.session.completed)
```
