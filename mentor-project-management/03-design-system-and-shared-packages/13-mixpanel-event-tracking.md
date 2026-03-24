# Analytics Event Tracking Setup (Provider-Agnostic)

## Description

Define and maintain a shared analytics tracking model across web and mobile using `@mentor/analytics`. This document is intentionally provider-agnostic and aligned with the current supported providers:

- `gtm`
- `noop`

The goal is consistent event taxonomy and initialization behavior independent of any specific third-party analytics vendor.

## Scope

- `packages/analytics` shared client and tracking helpers
- `packages/ui` web analytics provider wrapper
- `apps/mobile` Expo initialization
- App feature teams adding business events via shared helpers

## Event Model

### Core Event Types

1. `track` for business/user action events
2. `identify` for user association and trait updates
3. `page` for route/screen view events
4. `reset` for sign-out/session reset boundaries

### Naming Rules

- Use snake_case event names
- Keep event names domain-meaningful (`course_enrolled`, `payment_completed`)
- Keep event properties flat and serializable
- Avoid PII unless explicitly approved

## Initialization Rules

- Initialize analytics once during app bootstrap using `analytics.initialize()`
- Do not pass provider tokens from UI/app shell code
- Provider selection comes from environment:
  - `NEXT_PUBLIC_ANALYTICS_PROVIDER`
  - `EXPO_PUBLIC_ANALYTICS_PROVIDER`
- Unknown or missing provider should safely become `noop`

## Consent Rules

- Respect analytics consent before sending `track`, `identify`, and `page`
- Keep `initialize` and `reset` available regardless of consent

## Acceptance Criteria

- [x] Shared helper usage for page + product events
- [x] Web and mobile bootstraps call `analytics.initialize()` without provider-specific config
- [x] Event naming conventions documented and followed
- [x] Consent-aware behavior verified in tests
- [x] Provider selection remains `gtm | noop`

## Future Provider Migration Notes

If we adopt another analytics vendor later:

1. Implement a new adapter in `packages/analytics/src/providers`.
2. Extend provider enum in env schemas.
3. Keep event contracts unchanged for app code.
4. Validate no startup regressions on Expo and web runtimes.
