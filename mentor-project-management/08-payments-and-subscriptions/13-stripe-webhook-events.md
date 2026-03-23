# Stripe Webhook Events

This document lists the Stripe events to enable when configuring webhook destinations in the Stripe Dashboard.

Two separate destinations are required — one for platform-level events (Standard) and one for connected account events (Connect). Stripe routes these from different event streams and they cannot be merged into a single destination type.

---

## Standard Webhook

**Destination URL:** `POST /api/webhooks/stripe`
**Secret env var:** `STRIPE_WEBHOOK_SECRET`
**Destination type:** Your platform account

| Event                           | Purpose                                           |
| ------------------------------- | ------------------------------------------------- |
| `checkout.session.completed`    | Course purchase / subscription checkout completed |
| `invoice.paid`                  | Subscription invoice payment received             |
| `invoice.payment_failed`        | Subscription invoice payment failed               |
| `customer.subscription.created` | New subscription created                          |
| `customer.subscription.updated` | Subscription plan or status changed               |
| `customer.subscription.deleted` | Subscription cancelled                            |
| `charge.refunded`               | One-time course purchase refunded                 |
| `transfer.created`              | Instructor payout transfer initiated              |
| `transfer.updated`              | Instructor payout transfer status changed         |
| `transfer.reversed`             | Instructor payout transfer reversed               |

---

## Connect Webhook

**Destination URL:** `POST /api/webhooks/stripe/connect`
**Secret env var:** `STRIPE_CONNECT_WEBHOOK_SECRET`
**Destination type:** Connected accounts

| Event                              | Purpose                                                                       |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| `account.updated`                  | Instructor Connect account status changed (onboarding, payouts enabled, etc.) |
| `account.application.deauthorized` | Instructor disconnected their Stripe account                                  |

---

## Why Two Destinations?

- **Standard events** fire on your platform account (charges, subscriptions, transfers you initiate).
- **Connect events** fire on the connected account's event stream (instructor's Stripe account). Stripe does not forward these to a standard destination — a Connect-type destination with "Connected accounts" selected is required.

See: [https://docs.stripe.com/connect/webhooks](https://docs.stripe.com/connect/webhooks)
