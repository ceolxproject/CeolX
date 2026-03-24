# Analytics Adapter Package - Provider-Agnostic Analytics

## Description

Define `packages/analytics` as a provider-agnostic analytics layer that keeps a stable API for all apps while allowing provider swaps over time. The current production-safe baseline is:

- `gtm` provider for browser/mobile `dataLayer` style events
- `noop` provider as the default fallback when analytics is disabled or unconfigured

The package must remain future-provider-ready without requiring app-level call site changes.

## Affected Apps/Packages

- `packages/analytics` - shared analytics client/adapters
- `packages/env` - analytics provider env schema
- `packages/ui` - web analytics provider wrapper
- `apps/mobile` - app bootstrap analytics initialization
- All web apps consuming `@mentor/analytics`

## Current Contract

### Adapter Interface

- `initialize(config?: Record<string, unknown>)`
- `identify(userId, traits?)`
- `track(event, properties?)`
- `page(name, properties?)`
- `reset()`

### Runtime Provider Selection

- Read `NEXT_PUBLIC_ANALYTICS_PROVIDER` or `EXPO_PUBLIC_ANALYTICS_PROVIDER`
- Supported values: `gtm | noop`
- Fallback behavior: unknown/missing values resolve to `noop`

### Consent Behavior

- `identify`, `track`, `page` are gated behind analytics consent
- `initialize` and `reset` always execute

## Requirements

- Keep adapter API stable and strongly typed
- Default to non-breaking `noop` behavior
- Never crash app startup due to analytics config
- Keep provider implementations isolated under `src/providers/*`
- Preserve compatibility with web and Expo app bootstraps
- Keep package ready for future providers by adding new adapters without changing app code

## Acceptance Criteria

- [x] Provider set reduced to `gtm | noop`
- [x] No provider-specific tokens required at app call sites
- [x] Environment schemas in `@mentor/env` match provider set
- [x] Consent checks stay intact in client wrapper
- [x] Unknown provider values gracefully fallback to `noop`
- [x] Tests cover default/fallback/provider selection behavior

## Notes for Future Providers

When introducing another provider in future:

1. Add adapter implementation in `src/providers`.
2. Extend provider union in env schemas.
3. Update `createAdapter` branching in `src/client.ts`.
4. Add focused tests for adapter selection and no-crash initialization.
5. Avoid adding provider-specific bootstrap code in app shells.
